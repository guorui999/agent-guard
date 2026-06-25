# @agent-guard/nestjs

NestJS SDK for AgentGuard — policy engine for securing AI agent tool calls.

## Installation

```bash
npm install @agent-guard/nestjs
```

Requires Node.js >= 18.x, NestJS >= 10.x.

## Quick Start

### 1. Import the module

```typescript
import { Module } from '@nestjs/common';
import { AgentGuardModule } from '@agent-guard/nestjs';

@Module({
  imports: [AgentGuardModule.forRoot('policy.yaml')],
})
export class AppModule {}
```

### 2. Protect a controller endpoint

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

### 3. Use the interceptor (alternative)

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AgentGuardModule, ToolGuardInterceptor } from '@agent-guard/nestjs';

@Module({
  imports: [AgentGuardModule.forRoot('policy.yaml')],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ToolGuardInterceptor },
  ],
})
export class AppModule {}
```

## API

### `AgentGuardModule.forRoot(configPath?)`

Registers the AgentGuard service globally.

- `configPath` (string, optional) — Path to the policy YAML file. Defaults to `policy.example.yaml`.

### `@ToolGuard(toolName, sessionIdGenerator?)`

Decorator that marks a route for policy enforcement.

- `toolName` (string) — Matches against `match.tool` in policy rules.
- `sessionIdGenerator` (function, optional) — Custom function to derive session ID from the request.

### `AgentGuardService`

Injectable service with methods:

- `executePre(toolName, args, sessionId)` — Run pre-execution policies.
- `executePost(toolName, result, sessionId)` — Run post-execution policies.
- `approve(requestId)` — Approve a pending suspension request.
- `reject(requestId, reason?)` — Reject a pending suspension request.
- `listPending()` — List all pending suspension requests.
