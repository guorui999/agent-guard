import { Module } from '@nestjs/common';
import { AgentGuardModule } from '@agent-guard/nestjs';
import { ToolsController } from './app.controller';

@Module({
  imports: [AgentGuardModule.forRoot('policy.example.yaml')],
  controllers: [ToolsController],
})
export class AppModule {}
