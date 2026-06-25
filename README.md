# AgentGuard

[![License](https://img.shields.io/github/license/guorui999/agent-guard?style=flat-square)](LICENSE)
[![PyPI](https://img.shields.io/pypi/v/agent-guard?style=flat-square)](https://pypi.org/project/agent-guard/)
[![NPM](https://img.shields.io/npm/v/@agent-guard/nestjs?style=flat-square)](https://www.npmjs.com/package/@agent-guard/nestjs)
[![CI](https://img.shields.io/github/actions/workflow/status/guorui999/agent-guard/ci.yml?style=flat-square)](https://github.com/guorui999/agent-guard/actions)

> Policy engine for securing AI agent tool calls. | AI Agent 工具调用安全策略引擎。
>
> Supports Python (asyncio) and NestJS (Node.js).

---

## Features | 功能特性

- **Policy-based control** — Define rules in YAML for tool call interception | 基于 YAML 策略配置，拦截 Agent 工具调用
- **Risk argument blocking** — Regex blocking of dangerous inputs (`rm -rf`, SQL injection, etc.) | 正则匹配危险参数，如删除命令、SQL 注入等
- **Rate limiting** — Per-session rate limiting with `ASK_HUMAN` escalation | 每会话限流，支持人工审批升级
- **Sensitive data masking** — Automatic PII detection and redaction (ID numbers, phone numbers) | 自动检测并脱敏敏感数据（身份证号、手机号等）
- **Dual SDK** — Python and NestJS implementations, identical behavior | 双 SDK 实现，行为完全一致
- **Suspension mechanism** — Async wait for human approval with configurable timeout | 异步挂起等待人工审批，支持超时

---

## Installation | 安装

### Python SDK

```bash
pip install agent-guard
```

Requires Python >= 3.10. | 需要 Python >= 3.10。

### NestJS SDK

```bash
npm install @agent-guard/nestjs
```

Requires Node.js >= 18.x, NestJS >= 10.x. | 需要 Node.js >= 18.x, NestJS >= 10.x。

### From source | 源码开发

```bash
git clone https://github.com/guorui999/agent-guard.git
cd agent-guard

# Python
cd python && pip install -e ".[dev]"

# NestJS
cd nestjs && npm install
```

---

## Quick Start | 快速开始

### Python

Create a policy file `policy.yaml`: | 创建策略文件 `policy.yaml`：

```yaml
policies:
  - name: "高危指令拦截"
    match:
      tool: "shell_execute"
    pre:
      - type: "block_risk_args"
        regex: "rm -rf|drop table|shutdown"
        action: "REJECT"

  - name: "数据脱敏"
    match:
      tool: "*"
    post:
      - type: "mask_sensitive"
        patterns:
          - regex: "\\d{17}[0-9Xx]"
            replace: "[证件号已隐藏]"
```

Then use it: | 然后使用：

```python
import asyncio
from agent_guard import PolicyEngine, guard

engine = PolicyEngine("policy.yaml")

@guard(engine, session_id="demo")
async def shell_execute(command: str) -> str:
    return f"执行结果: {command}"

async def main():
    result = await shell_execute("echo hello")
    print(result)

asyncio.run(main())
```

### NestJS

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { AgentGuardModule } from '@agent-guard/nestjs';

@Module({
  imports: [AgentGuardModule.forRoot('policy.yaml')],
})
export class AppModule {}
```

```typescript
// tools.controller.ts
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

## Policy Reference | 策略规则参考

| Rule Type | Phase | Description (EN) | 说明 (CN) |
|-----------|-------|------------------|-----------|
| `block_risk_args` | `pre` | Reject requests matching a regex pattern | 拒绝匹配正则的危险参数 |
| `rate_limit` | `pre` | Limit calls per session; optionally ask for human approval | 限制调用次数，可选人工审批 |
| `mask_sensitive` | `post` | Replace sensitive data with placeholders | 用占位符替换敏感数据 |

Full example: [`policy.example.yaml`](policy.example.yaml) | 完整示例见 `policy.example.yaml`

---

## Repository Structure | 仓库结构

```
agent-guard/
├── python/               # Python SDK (agent_guard package)
│   ├── agent_guard/      #   Core library | 核心库
│   ├── tests/            #   Test suite | 测试
│   └── pyproject.toml    #   Build config | 构建配置
├── nestjs/               # NestJS SDK (@agent-guard/nestjs)
│   ├── src/              #   Core library | 核心库
│   ├── tests/            #   Test suite | 测试
│   └── package.json      #   Build config | 构建配置
├── examples/             # Usage examples | 使用示例
│   ├── python_demo.py
│   └── nest-demo/
├── policy.example.yaml   # Example policy config | 示例策略配置
├── LICENSE
└── README.md
```

---

## License | 开源许可证

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License
Copyright (c) 2026 guorui999

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

You may use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software. | 你可以自由使用、复制、修改、合并、发布、分发、再许可和/或出售本软件的副本。

本项目采用 **MIT 许可证** 开源，详细信息请参阅 [LICENSE](LICENSE) 文件。
