from __future__ import annotations

import logging
import json
import re
from typing import Any, Dict, List, Optional

import yaml

from .exceptions import PolicyViolationError
from .models import Policy, PolicyConfig, PreRule, PostRule
from .suspension import SuspensionManager

logger = logging.getLogger(__name__)


class PolicyEngine:
    def __init__(self, config_path: str = "policy.example.yaml"):
        self.config_path = config_path
        self.policies: List[Policy] = self._load_config(config_path)
        self._rate_counter: Dict[str, int] = {}
        self.suspension_manager = SuspensionManager()

    def _load_config(self, config_path: str) -> List[Policy]:
        with open(config_path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        config = PolicyConfig(**raw)
        logger.info(json.dumps({
            "event": "config_loaded",
            "path": config_path,
            "policy_count": len(config.policies),
        }))
        return config.policies

    def _match_policy(self, tool_name: str) -> List[Policy]:
        matched = []
        for policy in self.policies:
            if policy.match.tool == "*" or policy.match.tool == tool_name:
                matched.append(policy)
        return matched

    async def execute_pre(self, tool_name: str, args: dict, session_id: str) -> dict:
        matched_policies = self._match_policy(tool_name)
        logger.info(json.dumps({
            "event": "pre_execute",
            "tool_name": tool_name,
            "session_id": session_id,
            "matched_policies": len(matched_policies),
        }))

        args = dict(args) if args else {}

        for policy in matched_policies:
            if not policy.pre:
                continue
            for rule in policy.pre:
                if rule.type == "block_risk_args" and rule.regex:
                    for key, value in args.items():
                        if isinstance(value, str) and re.search(rule.regex, value, re.IGNORECASE):
                            raise PolicyViolationError(
                                policy_name=policy.name,
                                tool_name=tool_name,
                                reason=f"参数 {key} 包含危险内容: {value}",
                                action=rule.action,
                            )

                elif rule.type == "rate_limit":
                    counter_key = f"{session_id}:{tool_name}"
                    self._rate_counter[counter_key] = self._rate_counter.get(counter_key, 0) + 1
                    current = self._rate_counter[counter_key]
                    max_calls = rule.max_calls_per_session or 5

                    if current > max_calls:
                        if rule.action == "ASK_HUMAN":
                            request_id = self.suspension_manager.create_request(
                                tool_name=tool_name,
                                session_id=session_id,
                                args=args,
                            )
                            result = await self.suspension_manager.wait_for_approval(request_id)
                            if not result.get("approved", False):
                                raise PolicyViolationError(
                                    policy_name=policy.name,
                                    tool_name=tool_name,
                                    reason=result.get("reason", "人工审批拒绝"),
                                    action="REJECT",
                                )
                        elif rule.action == "REJECT":
                            raise PolicyViolationError(
                                policy_name=policy.name,
                                tool_name=tool_name,
                                reason=f"超过限流阈值 {max_calls}次/会话",
                                action="REJECT",
                            )

        return args

    async def execute_post(self, tool_name: str, result: Any, session_id: str) -> Any:
        matched_policies = self._match_policy(tool_name)
        logger.info(json.dumps({
            "event": "post_execute",
            "tool_name": tool_name,
            "session_id": session_id,
        }))

        result_str = str(result) if not isinstance(result, str) else result

        for policy in matched_policies:
            if not policy.post:
                continue
            for rule in policy.post:
                if rule.type == "mask_sensitive" and rule.patterns:
                    for pattern in rule.patterns:
                        result_str = re.sub(pattern.regex, pattern.replace, result_str)

        return result_str
