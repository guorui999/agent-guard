# AgentGuard Python SDK

> Policy engine for securing AI agent tool calls. | AI Agent 工具调用安全策略引擎。

---

## Installation | 安装

```bash
pip install agent-guard
```

Requires Python >= 3.10. | 需要 Python >= 3.10。

From source | 源码安装：

```bash
cd python
pip install -e ".[dev]"
```

---

## Quick Start | 快速开始

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

---

## API

### `PolicyEngine(config_path: str = "policy.example.yaml")`

Load policies from a YAML file. | 从 YAML 文件加载策略。

- `execute_pre(tool_name, args, session_id)` — Run pre-execution policies | 执行前置策略检查
- `execute_post(tool_name, result, session_id)` — Run post-execution policies | 执行后置策略处理

### `@guard(engine, session_id="default")`

Decorator that wraps an async function with policy enforcement. | 装饰器，为异步函数添加策略防护。

### `SuspensionManager`

- `create_request()` — Create a suspension request | 创建挂起请求
- `wait_for_approval()` — Wait for human approval (asyncio.Event) | 等待人工审批
- `approve(request_id)` / `reject(request_id, reason)` — External wake-up | 外部唤醒接口
- `list_pending()` — List all pending requests | 列出待审批请求

---

## Development | 开发

```bash
cd python
pip install -e ".[dev]"
pytest --cov=agent_guard --cov-report=term-missing
```

---

## License | 开源许可证

[MIT License](../LICENSE) — Copyright (c) 2026 guorui999
