

# 📘 AgentGuard 发布级技术蓝皮书 (v2.0)

> **AI指令**：请严格遵循本蓝皮书生成完整的Monorepo项目。目标：**代码即产品**。生成的代码必须包含完整的测试用例、CI配置、安装脚本和README，用户克隆后执行`pip install -e .`或`npm install`即可直接使用。

---

## 第一章：项目宪法（GitHub发布强制性规范）

### 1.1 许可证与社区文件
- 根目录必须包含 `LICENSE` 文件（使用 **MIT License**）。
- 根目录必须包含 `CODE_OF_CONDUCT.md`（引用Contributor Covenant 2.1）。
- 根目录必须包含 `CONTRIBUTING.md`（说明如何本地调试和提交PR）。

### 1.2 仓库结构（Monorepo布局）
```
agent-guard/
├── LICENSE
├── README.md
├── policy.example.yaml              # 统一配置文件
├── .github/
│   └── workflows/
│       ├── ci.yml                   # 同时跑Python和Node测试
│       └── publish.yml              # 自动发布到PyPI和NPM
├── python/                          # Python SDK 根目录
│   ├── agent_guard/
│   │   ├── __init__.py
│   │   ├── engine.py
│   │   ├── models.py
│   │   ├── exceptions.py
│   │   ├── suspension.py            # 挂起管理器（含asyncio.Event实现）
│   │   └── integrations/
│   │       ├── langchain_callback.py
│   │       └── decorator.py
│   ├── tests/                       # 必须 > 80% 覆盖率
│   ├── pyproject.toml               # 构建配置，包名 agent-guard
│   └── README.md
└── nestjs/                          # NestJS SDK 根目录
    ├── src/
    │   ├── agent-guard.module.ts
    │   ├── agent-guard.service.ts
    │   ├── agent-guard.decorator.ts
    │   ├── agent-guard.constants.ts
    │   └── interceptors/
    │       ├── tool-guard.interceptor.ts   # 完整拦截器实现
    │       └── mask.interceptor.ts
    ├── tests/                       # Jest E2E 测试
    ├── package.json                 # 包名 @agent-guard/nestjs
    └── README.md
```

### 1.3 CI/CD 强制要求
- **ci.yml**：在 push 和 PR 时触发。执行 Python（`pytest --cov`）和 NestJS（`npm run test:cov`）测试。若覆盖率<80%，流水线标红失败。
- **publish.yml**：仅在创建 `v*.*.*` Tag 时触发。自动构建并上传至 PyPI 和 NPM 公共仓库。

---

## 第二章：Python SDK 核心逻辑规格（完整实现）

### 2.1 依赖与版本
- Python `>=3.10`。依赖：`pyyaml>=6.0`, `pydantic>=2.0`, `jsonschema>=4.0`, `typing-extensions>=4.0`。

### 2.2 异常定义 (`exceptions.py`)
```python
class PolicyViolationError(Exception):
    def __init__(self, policy_name: str, tool_name: str, reason: str, action: str = "REJECT"):
        self.policy_name = policy_name
        self.tool_name = tool_name
        self.reason = reason
        self.action = action
        super().__init__(f"[{policy_name}] 拦截 {tool_name}: {reason}")
```

### 2.3 挂起管理器 (`suspension.py`)
**必须完整实现**推演二中的 `SuspensionManager` 类，包含：
- `create_request()`：创建挂起请求，返回唯一ID。
- `wait_for_approval()`：使用 `asyncio.Event` 挂起当前协程，支持超时。
- `approve()` / `reject()`：外部唤醒接口。
- `list_pending()`：列出所有待审批请求。

### 2.4 核心引擎 (`engine.py`)
```python
class PolicyEngine:
    def __init__(self, config_path: str = "policy.yaml"):
        self.policies: List[Policy] = self._load_config(config_path)
        self._rate_counter: dict[str, int] = {}
        self.suspension_manager = SuspensionManager()  # 挂起管理器实例

    async def execute_pre(self, tool_name: str, args: dict, session_id: str) -> dict:
        """返回修改后的args或直接抛出 PolicyViolationError"""
        # 实现逻辑见推演二
        return args

    async def execute_post(self, tool_name: str, result: Any, session_id: str) -> Any:
        """返回脱敏后的 result"""
        return result
```

### 2.5 LangChain 集成
在 `integrations/langchain_callback.py` 中实现继承自 `BaseCallbackHandler` 的类。

### 2.6 Python 装饰器 `@guard`
```python
def guard(engine: PolicyEngine, session_id: str = "default"):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 自动提取工具名（func.__name__）
            # 调用 engine.execute_pre
            # 执行 func
            # 调用 engine.execute_post
            return result
        return wrapper
    return decorator
```

---

## 第三章：NestJS SDK 核心逻辑规格（完整实现）

### 3.1 依赖与版本
- Node.js `>=18.x`，NestJS `>=10.x`。依赖：`js-yaml`, `class-validator`, `reflect-metadata`, `rxjs`。

### 3.2 模块设计
`AgentGuardModule` 必须提供 `forRoot(configPath: string)` 静态方法。

### 3.3 核心服务 (`AgentGuardService`)
- 实现 `OnModuleInit` 加载 YAML。
- 提供 `executePre()` 和 `executePost()` 方法。
- 内部维护限流计数器和挂起请求队列（参考推演二的设计理念，用 `Map` + `Promise` 实现挂起）。

### 3.4 装饰器 `@ToolGuard`（完整实现见推演一）
必须包含：
- `TOOL_GUARD_METADATA` 常量。
- `ToolGuard<T>(toolName, sessionIdGenerator?)` 泛型函数。
- `ToolGuardInterceptor` 完整拦截器，支持 `GET`/`POST` 参数提取，支持 `ASK_HUMAN` 挂起（通过 `await` + `Promise`）。

### 3.5 全局响应脱敏
`MaskInterceptor` 基于 YAML 配置，对返回结果中的敏感字段进行正则替换。

---

## 第四章：统一配置规范（YAML Schema）

根目录必须提供 `policy.example.yaml`：

```yaml
policies:
  - name: "高危指令拦截"
    match:
      tool: "shell_execute"
    pre:
      - type: "block_risk_args"
        regex: "rm -rf|drop table|shutdown"
        action: "REJECT"

  - name: "接口限流（需人工审批）"
    match:
      tool: "*"
    pre:
      - type: "rate_limit"
        max_calls_per_session: 5
        action: "ASK_HUMAN"

  - name: "数据脱敏"
    match:
      tool: "*"
    post:
      - type: "mask_sensitive"
        patterns:
          - regex: "\\d{17}[0-9Xx]"
            replace: "[证件号已隐藏]"
          - regex: "1[3-9]\\d{9}"
            replace: "[手机号已隐藏]"
```

---

## 第五章：示例代码（让用户5分钟跑通）

### 5.1 Python 示例 (`examples/python_demo.py`)
```python
import asyncio
from agent_guard import PolicyEngine, guard

engine = PolicyEngine("policy.example.yaml")

@guard(engine, session_id="demo_session")
async def shell_execute(command: str) -> str:
    # 模拟执行shell命令
    return f"执行结果: {command}"

async def main():
    try:
        # 安全调用
        result = await shell_execute("echo hello")
        print(result)
        # 触发拦截
        result = await shell_execute("rm -rf /")
    except Exception as e:
        print(f"拦截成功: {e}")

asyncio.run(main())
```

### 5.2 NestJS 示例 (`examples/nest-demo/src/app.controller.ts`)
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

## 第六章：测试强制规范

### 6.1 Python (`tests/`)
- `test_block_risk_args`：断言传入危险参数时抛出 `PolicyViolationError`。
- `test_rate_limit`：连续调用6次，第6次触发 `ASK_HUMAN`，使用 `SuspensionManager.approve()` 唤醒。
- `test_post_mask`：验证返回值中的身份证号被替换。

### 6.2 NestJS (`tests/`)
使用 `@nestjs/testing` + `supertest`，覆盖上述三个场景。

---

## ⚠️ AI 最终执行指令

> *“请严格按照上述六章内容生成完整代码。特别注意：1. 所有日志必须使用结构化 JSON 格式（Python 用 logging+json，NestJS 用 Logger）；2. README.md 必须包含醒目的 Badge（GitHub stars, license, PyPI, NPM）；3. 严禁生成占位符 `...` 或 `// TODO`，必须生成可直接运行的完整函数体；4. 确保 Python 和 NestJS 两边的正则匹配结果完全一致；5. Python 的 `SuspensionManager` 必须使用 `asyncio.Event` 实现挂起，NestJS 端使用 `Promise` + `setTimeout` 模拟超时。”*

---

