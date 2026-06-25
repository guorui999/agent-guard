import asyncio
import sys
sys.path.insert(0, "python")

from agent_guard import PolicyEngine, guard

engine = PolicyEngine("policy.example.yaml")


@guard(engine, session_id="demo_session")
async def shell_execute(command: str) -> str:
    return f"执行结果: {command}"


async def main():
    try:
        result = await shell_execute("echo hello")
        print(result)

        result = await shell_execute("rm -rf /")
        print(result)
    except Exception as e:
        print(f"拦截成功: {e}")


asyncio.run(main())
