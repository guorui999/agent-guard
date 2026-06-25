# AgentGuard Python SDK

Policy engine for securing AI agent tool calls.

## Installation

```bash
pip install agent-guard
```

## Quick Start

```python
import asyncio
from agent_guard import PolicyEngine, guard

engine = PolicyEngine("policy.example.yaml")

@guard(engine, session_id="demo_session")
async def shell_execute(command: str) -> str:
    return f"执行结果: {command}"

async def main():
    result = await shell_execute("echo hello")
    print(result)

asyncio.run(main())
```
