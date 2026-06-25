import { DynamicModule, Module } from '@nestjs/common';
import { AgentGuardService } from './agent-guard.service';
import { AGENT_GUARD_OPTIONS } from './agent-guard.constants';

export interface AgentGuardOptions {
  configPath: string;
  suspensionTimeout?: number;
}

@Module({})
export class AgentGuardModule {
  static forRoot(configPath: string = 'policy.example.yaml'): DynamicModule {
    return {
      module: AgentGuardModule,
      providers: [
        {
          provide: AGENT_GUARD_OPTIONS,
          useValue: { configPath },
        },
        AgentGuardService,
      ],
      exports: [AgentGuardService],
      global: true,
    };
  }
}
