# @agent-guard/nestjs

> NestJS SDK for AgentGuard — policy engine for securing AI agent tool calls. | AI Agent 工具调用安全策略引擎 (NestJS)。

---

## Installation | 安装

```bash
npm install @agent-guard/nestjs
```

Requires Node.js >= 18.x, NestJS >= 10.x. | 需要 Node.js >= 18.x, NestJS >= 10.x。

---

## Quick Start | 快速开始

### 1. Import module | 导入模块

```typescript
import { Module } from '@nestjs/common';
import { AgentGuardModule } from '@agent-guard/nestjs';

@Module({
  imports: [AgentGuardModule.forRoot('policy.yaml')],
})
export class AppModule {}
```

### 2. Protect an endpoint | 保护接口

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

---

## API

### `AgentGuardModule.forRoot(configPath?)`

Register the AgentGuard service globally. | 全局注册 AgentGuard 服务。

- `configPath` (string, optional) — Path to the policy YAML file. Default: `policy.example.yaml` | 策略 YAML 文件路径，默认 `policy.example.yaml`

### `@ToolGuard(toolName, sessionIdGenerator?)`

Mark a route for policy enforcement. | 标记路由需要策略防护。

- `toolName` (string) — Matches `match.tool` in policy rules | 匹配策略中的 `match.tool`
- `sessionIdGenerator` (function, optional) — Custom session ID derivation | 自定义 session ID 生成函数

### `AgentGuardService`

| Method | Description (EN) | 说明 (CN) |
|--------|------------------|-----------|
| `executePre(toolName, args, sessionId)` | Run pre-execution policies | 执行前置策略 |
| `executePost(toolName, result, sessionId)` | Run post-execution policies | 执行后置策略 |
| `approve(requestId)` | Approve a pending suspension | 审批通过挂起请求 |
| `reject(requestId, reason?)` | Reject a pending suspension | 拒绝挂起请求 |
| `listPending()` | List all pending suspensions | 列出待审批请求 |

---

## Development | 开发

```bash
cd nestjs
npm install
npm run test
npm run test:cov
```

---

## License | 开源许可证

[MIT License](../LICENSE) — Copyright (c) 2026 guorui999
