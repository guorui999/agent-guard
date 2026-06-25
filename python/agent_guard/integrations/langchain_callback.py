from __future__ import annotations

import logging
import json
from typing import Any, Dict, List, Optional

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.agents import AgentAction, AgentFinish

from ..engine import PolicyEngine

logger = logging.getLogger(__name__)


class AgentGuardCallbackHandler(BaseCallbackHandler):
    def __init__(self, engine: PolicyEngine, session_id: str = "default"):
        self.engine = engine
        self.session_id = session_id

    async def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        **kwargs: Any,
    ) -> None:
        tool_name = serialized.get("name", "unknown_tool")
        logger.info(json.dumps({
            "event": "langchain_tool_start",
            "tool_name": tool_name,
            "session_id": self.session_id,
        }))
        await self.engine.execute_pre(tool_name, {"input": input_str}, self.session_id)

    async def on_tool_end(
        self,
        output: str,
        **kwargs: Any,
    ) -> None:
        logger.info(json.dumps({
            "event": "langchain_tool_end",
            "session_id": self.session_id,
        }))

    async def on_agent_action(
        self,
        action: AgentAction,
        **kwargs: Any,
    ) -> None:
        logger.info(json.dumps({
            "event": "langchain_agent_action",
            "tool": action.tool,
            "session_id": self.session_id,
        }))
