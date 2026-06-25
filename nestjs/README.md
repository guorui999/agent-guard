# @agent-guard/nestjs

NestJS SDK for AgentGuard - policy engine for securing AI agent tool calls.

## Installation

```bash
npm install @agent-guard/nestjs
```

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { AgentGuardModule, ToolGuard } from '@agent-guard/nestjs';

@Module({
  imports: [AgentGuardModule.forRoot('policy.example.yaml')],
})
export class AppModule {}
```

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { ToolGuard } from '@agent-guard/nestjs';

@Controller('tools')
export class ToolsController {
  @Post('shell')
  @ToolGuard('shell_execute')
  async runShell(@Body('args') args: { command: string }) {
    return { output: `执行结果: ${args.command}` };
  }
}
```
