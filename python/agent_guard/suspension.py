from __future__ import annotations

import asyncio
import uuid
import logging
import json
from typing import Dict, Optional

from .models import SuspensionRequest

logger = logging.getLogger(__name__)


class SuspensionManager:
    def __init__(self):
        self._requests: Dict[str, SuspensionRequest] = {}
        self._events: Dict[str, asyncio.Event] = {}
        self._results: Dict[str, dict] = {}

    def create_request(self, tool_name: str, session_id: str, args: dict) -> str:
        request_id = str(uuid.uuid4())
        req = SuspensionRequest(
            id=request_id,
            tool_name=tool_name,
            session_id=session_id,
            args=args,
            status="PENDING",
        )
        self._requests[request_id] = req
        self._events[request_id] = asyncio.Event()
        logger.info(json.dumps({
            "event": "suspension_request_created",
            "request_id": request_id,
            "tool_name": tool_name,
            "session_id": session_id,
        }))
        return request_id

    async def wait_for_approval(self, request_id: str, timeout: float = 300.0) -> dict:
        event = self._events.get(request_id)
        if event is None:
            raise ValueError(f"Unknown request_id: {request_id}")

        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            self._requests[request_id].status = "TIMEOUT"
            logger.warning(json.dumps({
                "event": "suspension_timeout",
                "request_id": request_id,
            }))
            raise TimeoutError(f"Suspension request {request_id} timed out after {timeout}s")

        result = self._results.pop(request_id, {"approved": True})
        self._events.pop(request_id, None)
        self._requests.pop(request_id, None)
        return result

    def approve(self, request_id: str) -> None:
        req = self._requests.get(request_id)
        if req is None:
            raise ValueError(f"Unknown request_id: {request_id}")
        req.status = "APPROVED"
        self._results[request_id] = {"approved": True}
        self._events[request_id].set()
        logger.info(json.dumps({
            "event": "suspension_approved",
            "request_id": request_id,
        }))

    def reject(self, request_id: str, reason: str = "Rejected by human") -> None:
        req = self._requests.get(request_id)
        if req is None:
            raise ValueError(f"Unknown request_id: {request_id}")
        req.status = "REJECTED"
        self._results[request_id] = {"approved": False, "reason": reason}
        self._events[request_id].set()
        logger.info(json.dumps({
            "event": "suspension_rejected",
            "request_id": request_id,
            "reason": reason,
        }))

    def list_pending(self) -> list[dict]:
        return [
            req.model_dump()
            for req in self._requests.values()
            if req.status == "PENDING"
        ]
