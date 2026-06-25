import { Test, TestingModule } from '@nestjs/testing';
import { AgentGuardService, PolicyViolationError } from '../src/agent-guard.service';
import { AGENT_GUARD_OPTIONS } from '../src/agent-guard.constants';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

const TEST_CONFIG_PATH = path.resolve(__dirname, '../../policy.example.yaml');

function ensureTestConfig() {
  if (!fs.existsSync(TEST_CONFIG_PATH)) {
    const exampleConfig = {
      policies: [
        {
          name: '高危指令拦截',
          match: { tool: 'shell_execute' },
          pre: [{ type: 'block_risk_args', regex: 'rm -rf|drop table|shutdown', action: 'REJECT' }],
        },
        {
          name: '接口限流（需人工审批）',
          match: { tool: '*' },
          pre: [{ type: 'rate_limit', max_calls_per_session: 5, action: 'ASK_HUMAN' }],
        },
        {
          name: '数据脱敏',
          match: { tool: '*' },
          post: [{
            type: 'mask_sensitive',
            patterns: [
              { regex: '\\d{17}[0-9Xx]', replace: '[证件号已隐藏]' },
              { regex: '1[3-9]\\d{9}', replace: '[手机号已隐藏]' },
            ],
          }],
        },
      ],
    };
    fs.writeFileSync(TEST_CONFIG_PATH, yaml.dump(exampleConfig), 'utf-8');
  }
}

describe('AgentGuardService', () => {
  let service: AgentGuardService;

  beforeAll(() => {
    ensureTestConfig();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AGENT_GUARD_OPTIONS,
          useValue: { configPath: TEST_CONFIG_PATH },
        },
        AgentGuardService,
      ],
    }).compile();

    service = module.get<AgentGuardService>(AgentGuardService);
    await module.init();
  });

  describe('executePre - block_risk_args', () => {
    it('should reject dangerous commands', async () => {
      await expect(
        service.executePre('shell_execute', { command: 'rm -rf /' }, 'test-session'),
      ).rejects.toThrow(PolicyViolationError);
    });

    it('should reject drop table commands', async () => {
      await expect(
        service.executePre('shell_execute', { command: 'drop table users' }, 'test-session'),
      ).rejects.toThrow(PolicyViolationError);
    });

    it('should allow safe commands', async () => {
      const args = { command: 'echo hello' };
      const result = await service.executePre('shell_execute', args, 'test-session');
      expect(result).toEqual(args);
    });
  });

  describe('executePre - rate_limit', () => {
    it('should allow up to 5 calls', async () => {
      for (let i = 0; i < 5; i++) {
        await service.executePre('rate_test_tool', { cmd: `cmd${i}` }, 'rate-session');
      }
    });

    it('should approve on 6th call via ASK_HUMAN', async () => {
      const sessionId = 'rate-ask-human';
      for (let i = 0; i < 5; i++) {
        await service.executePre('rate_ask_tool', { cmd: `cmd${i}` }, sessionId);
      }

      const execPromise = service.executePre('rate_ask_tool', { cmd: 'cmd6' }, sessionId);

      setTimeout(() => {
        const pending = service.listPending();
        if (pending.length > 0) {
          service.approve(pending[0].id);
        }
      }, 200);

      await expect(execPromise).resolves.toEqual({ cmd: 'cmd6' });
    });
  });

  describe('executePost - mask_sensitive', () => {
    it('should mask ID card numbers', async () => {
      const result = await service.executePost(
        'mask_test',
        '身份证号: 110101199001011234',
        'test-session',
      );
      expect(result).toContain('[证件号已隐藏]');
      expect(result).not.toContain('110101199001011234');
    });

    it('should mask phone numbers', async () => {
      const result = await service.executePost(
        'mask_test',
        '手机号: 13800138000',
        'test-session',
      );
      expect(result).toContain('[手机号已隐藏]');
      expect(result).not.toContain('13800138000');
    });

    it('should mask both ID card and phone', async () => {
      const result = await service.executePost(
        'mask_test',
        '身份证: 110101199001011234, 手机: 13800138000',
        'test-session',
      );
      expect(result).toContain('[证件号已隐藏]');
      expect(result).toContain('[手机号已隐藏]');
    });
  });

  describe('suspension timeout', () => {
    let timeoutService: AgentGuardService;

    beforeEach(async () => {
      const tmpConfig = path.resolve(__dirname, '../tmp_timeout_test.yaml');
      fs.writeFileSync(tmpConfig, yaml.dump({
        policies: [{
          name: '超时测试',
          match: { tool: 'timeout_tool' },
          pre: [{ type: 'rate_limit', max_calls_per_session: 1, action: 'ASK_HUMAN' }],
        }],
      }), 'utf-8');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: AGENT_GUARD_OPTIONS,
            useValue: { configPath: tmpConfig, suspensionTimeout: 100 },
          },
          AgentGuardService,
        ],
      }).compile();

      timeoutService = module.get<AgentGuardService>(AgentGuardService);
      await module.init();
    });

    afterEach(() => {
      const tmpConfig = path.resolve(__dirname, '../tmp_timeout_test.yaml');
      if (fs.existsSync(tmpConfig)) fs.unlinkSync(tmpConfig);
    });

    it('should throw on suspension timeout', async () => {
      await timeoutService.executePre('timeout_tool', { cmd: 'a' }, 'timeout-session');
      await expect(
        timeoutService.executePre('timeout_tool', { cmd: 'b' }, 'timeout-session'),
      ).rejects.toThrow(Error);
    }, 10000);
  });

  describe('rate_limit with REJECT action', () => {
    let rejectService: AgentGuardService;

    beforeEach(async () => {
      const tmpDir = fs.mkdtempSync('reject-');
      const tmpConfig = path.join(tmpDir, 'reject.yaml');
      fs.writeFileSync(tmpConfig, yaml.dump({
        policies: [{
          name: '严格限流',
          match: { tool: 'strict_tool' },
          pre: [{ type: 'rate_limit', max_calls_per_session: 2, action: 'REJECT' }],
        }],
      }), 'utf-8');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          { provide: AGENT_GUARD_OPTIONS, useValue: { configPath: tmpConfig } },
          AgentGuardService,
        ],
      }).compile();

      rejectService = module.get<AgentGuardService>(AgentGuardService);
      await module.init();
    });

    it('should reject on exceeding rate limit with REJECT action', async () => {
      await rejectService.executePre('strict_tool', { cmd: 'a' }, 'reject-session');
      await rejectService.executePre('strict_tool', { cmd: 'b' }, 'reject-session');
      await expect(
        rejectService.executePre('strict_tool', { cmd: 'c' }, 'reject-session'),
      ).rejects.toThrow(PolicyViolationError);
    });
  });

  describe('suspension management', () => {
    it('should approve suspension via rate limit threshold', async () => {
      const sessionId = 'susp-approve';
      for (let i = 0; i < 5; i++) {
        await service.executePre('susp_approve_tool', { cmd: `pre${i}` }, sessionId);
      }
      const promise = service.executePre('susp_approve_tool', { cmd: 'trigger' }, sessionId);
      setTimeout(() => {
        const pending = service.listPending();
        if (pending.length > 0) {
          service.approve(pending[0].id);
        }
      }, 200);
      const result = await promise;
      expect(result).toEqual({ cmd: 'trigger' });
    });

    it('should reject suspension via rate limit threshold', async () => {
      const sessionId = 'susp-reject';
      for (let i = 0; i < 5; i++) {
        await service.executePre('susp_reject_tool', { cmd: `pre${i}` }, sessionId);
      }
      const promise = service.executePre('susp_reject_tool', { cmd: 'trigger' }, sessionId);
      setTimeout(() => {
        const pending = service.listPending();
        if (pending.length > 0) {
          service.reject(pending[0].id, 'Not authorized');
        }
      }, 200);
      await expect(promise).rejects.toThrow(PolicyViolationError);
    });
  });
});
