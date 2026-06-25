from __future__ import annotations

import asyncio
import pytest
from pathlib import Path

from agent_guard import PolicyEngine, PolicyViolationError


@pytest.fixture
def config_path():
    return str(Path(__file__).parent.parent.parent / "policy.example.yaml")


@pytest.fixture
def engine(config_path):
    return PolicyEngine(config_path)


@pytest.mark.asyncio
async def test_block_risk_args(engine):
    with pytest.raises(PolicyViolationError) as exc_info:
        await engine.execute_pre(
            "shell_execute",
            {"command": "rm -rf /"},
            session_id="test_session",
        )
    assert "危险内容" in str(exc_info.value)
    assert exc_info.value.action == "REJECT"


@pytest.mark.asyncio
async def test_safe_args_pass_through(engine):
    args = {"command": "echo hello"}
    result = await engine.execute_pre(
        "shell_execute",
        args,
        session_id="test_session",
    )
    assert result == args


@pytest.mark.asyncio
async def test_rate_limit_ask_human(engine):
    session_id = "rate_limit_test"
    for i in range(5):
        await engine.execute_pre("any_tool", {"cmd": f"cmd{i}"}, session_id)

    async def approve_suspension():
        import asyncio
        while len(engine.suspension_manager.list_pending()) == 0:
            await asyncio.sleep(0.05)
        pending = engine.suspension_manager.list_pending()
        engine.suspension_manager.approve(pending[0]["id"])

    task = asyncio.create_task(approve_suspension())
    result = await engine.execute_pre("any_tool", {"cmd": "cmd6"}, session_id)
    await task
    assert result == {"cmd": "cmd6"}


@pytest.mark.asyncio
async def test_suspension_approve(engine):
    request_id = engine.suspension_manager.create_request(
        tool_name="test_tool",
        session_id="test_session",
        args={"cmd": "test"},
    )
    assert request_id is not None
    assert len(engine.suspension_manager.list_pending()) == 1

    async def approve_later():
        await asyncio.sleep(0.1)
        engine.suspension_manager.approve(request_id)

    async def wait_for_approval():
        result = await engine.suspension_manager.wait_for_approval(request_id, timeout=5.0)
        return result

    result = await asyncio.gather(approve_later(), wait_for_approval())
    assert result[1]["approved"] is True
    assert len(engine.suspension_manager.list_pending()) == 0


@pytest.mark.asyncio
async def test_suspension_reject(engine):
    request_id = engine.suspension_manager.create_request(
        tool_name="test_tool",
        session_id="test_session",
        args={"cmd": "test"},
    )

    async def reject_later():
        await asyncio.sleep(0.1)
        engine.suspension_manager.reject(request_id, reason="Not allowed")

    async def wait_for_rejection():
        return await engine.suspension_manager.wait_for_approval(request_id, timeout=5.0)

    result = await asyncio.gather(reject_later(), wait_for_rejection())
    assert result[1]["approved"] is False
    assert result[1]["reason"] == "Not allowed"


@pytest.mark.asyncio
async def test_post_mask_id_card(engine):
    result = await engine.execute_post(
        "any_tool",
        "身份证号: 110101199001011234",
        session_id="test_session",
    )
    assert "[证件号已隐藏]" in result
    assert "110101199001011234" not in result


@pytest.mark.asyncio
async def test_post_mask_phone(engine):
    result = await engine.execute_post(
        "any_tool",
        "手机号: 13800138000",
        session_id="test_session",
    )
    assert "[手机号已隐藏]" in result
    assert "13800138000" not in result


@pytest.mark.asyncio
async def test_post_mask_both(engine):
    result = await engine.execute_post(
        "any_tool",
        "身份证: 110101199001011234, 手机: 13800138000",
        session_id="test_session",
    )
    assert "[证件号已隐藏]" in result
    assert "[手机号已隐藏]" in result
    assert "110101199001011234" not in result
    assert "13800138000" not in result


@pytest.mark.asyncio
async def test_suspension_timeout(engine):
    request_id = engine.suspension_manager.create_request(
        tool_name="test_tool",
        session_id="test_session",
        args={"cmd": "test"},
    )
    with pytest.raises(TimeoutError):
        await engine.suspension_manager.wait_for_approval(request_id, timeout=0.1)


@pytest.mark.asyncio
async def test_rate_limit_exceed_reject(engine):
    import tempfile, yaml, os
    test_config = {
        "policies": [
            {
                "name": "限流拒绝",
                "match": {"tool": "reject_test_tool"},
                "pre": [{"type": "rate_limit", "max_calls_per_session": 2, "action": "REJECT"}],
            }
        ]
    }
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        yaml.dump(test_config, f)
        tmp_path = f.name
    try:
        eng = PolicyEngine(tmp_path)
        await eng.execute_pre("reject_test_tool", {"cmd": "a"}, "s1")
        await eng.execute_pre("reject_test_tool", {"cmd": "b"}, "s1")
        with pytest.raises(PolicyViolationError) as exc_info:
            await eng.execute_pre("reject_test_tool", {"cmd": "c"}, "s1")
        assert "限流" in str(exc_info.value)
    finally:
        os.unlink(tmp_path)


def test_list_pending(engine):
    r1 = engine.suspension_manager.create_request("tool1", "s1", {"a": 1})
    r2 = engine.suspension_manager.create_request("tool2", "s2", {"b": 2})
    pending = engine.suspension_manager.list_pending()
    assert len(pending) == 2
    assert all(p["status"] == "PENDING" for p in pending)
