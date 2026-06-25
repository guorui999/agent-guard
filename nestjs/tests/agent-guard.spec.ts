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

  describe('suspension management', () => {
    it('should approve suspension', async () => {
      const promise = service.executePre('suspension_test', { cmd: 'test' }, 'suspension-session');
      setTimeout(() => {
        const pending = service.listPending();
        if (pending.length > 0) {
          service.approve(pending[0].id);
        }
      }, 200);
      const result = await promise;
      expect(result).toEqual({ cmd: 'test' });
    });
  });
});
