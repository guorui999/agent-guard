import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AGENT_GUARD_OPTIONS } from './agent-guard.constants';
import { AgentGuardOptions } from './agent-guard.module';

interface MaskPattern {
  regex: string;
  replace: string;
}

interface PreRule {
  type: string;
  regex?: string;
  action?: string;
  max_calls_per_session?: number;
}

interface PostRule {
  type: string;
  patterns?: MaskPattern[];
}

interface Policy {
  name: string;
  match: { tool: string };
  pre?: PreRule[];
  post?: PostRule[];
}

interface SuspensionRequest {
  id: string;
  toolName: string;
  sessionId: string;
  args: Record<string, any>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'TIMEOUT';
  resolve?: (value: { approved: boolean; reason?: string }) => void;
  reject?: (reason: string) => void;
}

@Injectable()
export class AgentGuardService implements OnModuleInit {
  private readonly logger = new Logger(AgentGuardService.name);
  private policies: Policy[] = [];
  private rateCounter: Map<string, number> = new Map();
  private suspensionRequests: Map<string, SuspensionRequest> = new Map();
  private requestIdCounter = 0;

  constructor(
    @Inject(AGENT_GUARD_OPTIONS) private options: AgentGuardOptions,
  ) {}

  onModuleInit() {
    const configPath = path.resolve(this.options.configPath);
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = yaml.load(raw) as any;
    this.policies = parsed.policies || [];
    this.logger.log(`Loaded ${this.policies.length} policies from ${configPath}`);
  }

  private matchPolicies(toolName: string): Policy[] {
    return this.policies.filter(
      (p) => p.match.tool === '*' || p.match.tool === toolName,
    );
  }

  async executePre(
    toolName: string,
    args: Record<string, any>,
    sessionId: string,
  ): Promise<Record<string, any>> {
    const matched = this.matchPolicies(toolName);
    this.logger.log(`executePre: ${toolName}, matched: ${matched.length}`);

    const safeArgs = { ...args };

    for (const policy of matched) {
      if (!policy.pre) continue;

      for (const rule of policy.pre) {
        if (rule.type === 'block_risk_args' && rule.regex) {
          for (const [key, value] of Object.entries(safeArgs)) {
            if (typeof value === 'string' && new RegExp(rule.regex, 'i').test(value)) {
              throw new PolicyViolationError(
                policy.name,
                toolName,
                `参数 ${key} 包含危险内容: ${value}`,
                rule.action || 'REJECT',
              );
            }
          }
        }

        if (rule.type === 'rate_limit') {
          const counterKey = `${sessionId}:${toolName}`;
          const current = (this.rateCounter.get(counterKey) || 0) + 1;
          this.rateCounter.set(counterKey, current);
          const maxCalls = rule.max_calls_per_session || 5;

          if (current > maxCalls) {
            if (rule.action === 'ASK_HUMAN') {
              const approved = await this.createSuspension(toolName, sessionId, safeArgs);
              if (!approved) {
                throw new PolicyViolationError(
                  policy.name,
                  toolName,
                  '人工审批拒绝',
                  'REJECT',
                );
              }
            } else if (rule.action === 'REJECT') {
              throw new PolicyViolationError(
                policy.name,
                toolName,
                `超过限流阈值 ${maxCalls}次/会话`,
                'REJECT',
              );
            }
          }
        }
      }
    }

    return safeArgs;
  }

  async executePost(
    toolName: string,
    result: any,
    sessionId: string,
  ): Promise<any> {
    const matched = this.matchPolicies(toolName);
    let resultStr = String(result);

    for (const policy of matched) {
      if (!policy.post) continue;

      for (const rule of policy.post) {
        if (rule.type === 'mask_sensitive' && rule.patterns) {
          for (const pattern of rule.patterns) {
            resultStr = resultStr.replace(new RegExp(pattern.regex, 'g'), pattern.replace);
          }
        }
      }
    }

    return resultStr;
  }

  private createSuspension(
    toolName: string,
    sessionId: string,
    args: Record<string, any>,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const id = `req_${++this.requestIdCounter}`;
      const request: SuspensionRequest = {
        id,
        toolName,
        sessionId,
        args,
        status: 'PENDING',
        resolve: (value) => resolve(value.approved),
      };

      this.suspensionRequests.set(id, request);
      this.logger.log(`Suspension created: ${id} for ${toolName}`);

      setTimeout(() => {
        const req = this.suspensionRequests.get(id);
        if (req && req.status === 'PENDING') {
          req.status = 'TIMEOUT';
          this.suspensionRequests.delete(id);
          reject(new Error(`Suspension ${id} timed out`));
        }
      }, 300000);
    });
  }

  approve(requestId: string): void {
    const req = this.suspensionRequests.get(requestId);
    if (!req) throw new Error(`Unknown request: ${requestId}`);
    req.status = 'APPROVED';
    if (req.resolve) req.resolve({ approved: true });
    this.suspensionRequests.delete(requestId);
    this.logger.log(`Suspension approved: ${requestId}`);
  }

  reject(requestId: string, reason?: string): void {
    const req = this.suspensionRequests.get(requestId);
    if (!req) throw new Error(`Unknown request: ${requestId}`);
    req.status = 'REJECTED';
    if (req.resolve) req.resolve({ approved: false, reason });
    this.suspensionRequests.delete(requestId);
    this.logger.log(`Suspension rejected: ${requestId}`);
  }

  listPending(): SuspensionRequest[] {
    return Array.from(this.suspensionRequests.values()).filter(
      (r) => r.status === 'PENDING',
    );
  }
}

export class PolicyViolationError extends Error {
  constructor(
    public policyName: string,
    public toolName: string,
    reason: string,
    public action: string = 'REJECT',
  ) {
    super(`[${policyName}] 拦截 ${toolName}: ${reason}`);
    this.name = 'PolicyViolationError';
  }
}
