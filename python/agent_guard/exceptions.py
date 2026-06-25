class PolicyViolationError(Exception):
    def __init__(self, policy_name: str, tool_name: str, reason: str, action: str = "REJECT"):
        self.policy_name = policy_name
        self.tool_name = tool_name
        self.reason = reason
        self.action = action
        super().__init__(f"[{policy_name}] 拦截 {tool_name}: {reason}")
