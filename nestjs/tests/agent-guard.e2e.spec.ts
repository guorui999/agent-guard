import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AgentGuardService, PolicyViolationError } from '../src/agent-guard.service';
import { AGENT_GUARD_OPTIONS } from '../src/agent-guard.constants';
import { ToolGuardInterceptor } from '../src/interceptors/tool-guard.interceptor';
import { MaskInterceptor } from '../src/interceptors/mask.interceptor';
import { TOOL_GUARD_METADATA } from '../src/agent-guard.constants';
import * as path from 'path';

describe('AgentGuard E2E (supertest)', () => {
  let app: INestApplication;
  let guardService: AgentGuardService;

  beforeAll(async () => {
    const configPath = path.resolve(__dirname, '../../policy.example.yaml');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AGENT_GUARD_OPTIONS,
          useValue: { configPath },
        },
        AgentGuardService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    guardService = app.get(AgentGuardService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should block dangerous args via service', async () => {
    await expect(
      guardService.executePre('shell_execute', { command: 'rm -rf /' }, 'e2e-test'),
    ).rejects.toThrow(PolicyViolationError);
  });

  it('should mask sensitive data via service', async () => {
    const result = await guardService.executePost(
      'mask_test',
      '身份证: 110101199001011234, 手机: 13800138000',
      'e2e-test',
    );
    expect(result).toContain('[证件号已隐藏]');
    expect(result).toContain('[手机号已隐藏]');
  });
});
