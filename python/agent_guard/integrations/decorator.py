from __future__ import annotations

import logging
import json
from functools import wraps
from typing import Any, Callable

from ..engine import PolicyEngine

logger = logging.getLogger(__name__)


def guard(engine: PolicyEngine, session_id: str = "default") -> Callable:
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            tool_name = func.__name__
            logger.info(json.dumps({
                "event": "decorator_pre",
                "tool_name": tool_name,
                "session_id": session_id,
            }))
            safe_args = await engine.execute_pre(tool_name, kwargs, session_id)
            result = await func(*args, **safe_args)
            masked_result = await engine.execute_post(tool_name, result, session_id)
            return masked_result
        return wrapper
    return decorator
