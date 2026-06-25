# AgentGuard

[![License](https://img.shields.io/github/license/agent-guard/agent-guard?style=flat-square)](LICENSE)
[![PyPI](https://img.shields.io/pypi/v/agent-guard?style=flat-square)](https://pypi.org/project/agent-guard/)
[![NPM](https://img.shields.io/npm/v/@agent-guard/nestjs?style=flat-square)](https://www.npmjs.com/package/@agent-guard/nestjs)
[![CI](https://img.shields.io/github/actions/workflow/status/agent-guard/agent-guard/ci.yml?style=flat-square)](https://github.com/agent-guard/agent-guard/actions)

> Policy engine for securing AI agent tool calls. Supports Python (asyncio) and NestJS (Node.js).

## Features

- **Policy-based control** — Define rules in YAML for tool call interception
- **Risk argument blocking** — Regex-based blocking of dangerous inputs (`rm -rf`, SQL injection, etc.)
- **Rate limiting** — Per-session rate limiting with `ASK_HUMAN` escalation
- **Sensitive data masking** — Automatic PII detection and redaction (ID numbers, phone numbers, etc.)
- **Dual SDK** — Python and NestJS implementations with identical behavior
- **Suspension mechanism** — Async wait for human approval with configurable timeout

## Installation

### Python SDK

```bash
pip install agent-guard
```

Requires Python >= 3.10.

### NestJS SDK

```bash
npm install @agent-guard/nestjs
```

Requires Node.js >= 18.x, NestJS >= 10.x.

### From source (development)

```bash
git clone https://github.com/guorui999/agent-guard.git
cd agent-guard

# Python
cd python && pip install -e ".[dev]"

# NestJS
cd nestjs && npm install
```

## Quick Start

### Python

Create a policy file `policy.yaml`:

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

Then use it:

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

## Policy Reference

See [`policy.example.yaml`](policy.example.yaml) for a complete reference.

| Rule Type | Phase | Description |
|-----------|-------|-------------|
| `block_risk_args` | `pre` | Reject requests matching a regex pattern |
| `rate_limit` | `pre` | Limit calls per session; optionally ask for human approval |
| `mask_sensitive` | `post` | Replace sensitive data with placeholders in responses |

## Repository Structure

```
agent-guard/
├── python/               # Python SDK (agent_guard package)
│   ├── agent_guard/
│   ├── tests/
│   └── pyproject.toml
├── nestjs/               # NestJS SDK (@agent-guard/nestjs)
│   ├── src/
│   ├── tests/
│   └── package.json
├── examples/             # Usage examples
│   ├── python_demo.py
│   └── nest-demo/
├── policy.example.yaml
├── LICENSE
└── README.md
```

## License

MIT
