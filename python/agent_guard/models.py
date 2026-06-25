from __future__ import annotations

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class MaskPattern(BaseModel):
    regex: str
    replace: str


class PreRule(BaseModel):
    type: str
    regex: Optional[str] = None
    action: str = "REJECT"
    max_calls_per_session: Optional[int] = None


class PostRule(BaseModel):
    type: str
    patterns: Optional[List[MaskPattern]] = None


class MatchCondition(BaseModel):
    tool: str


class Rule(BaseModel):
    pre: Optional[List[PreRule]] = None
    post: Optional[List[PostRule]] = None


class Policy(BaseModel):
    name: str
    match: MatchCondition
    pre: Optional[List[PreRule]] = None
    post: Optional[List[PostRule]] = None


class PolicyConfig(BaseModel):
    policies: List[Policy]


class SuspensionRequest(BaseModel):
    id: str
    tool_name: str
    session_id: str
    args: dict
    status: str = "PENDING"
