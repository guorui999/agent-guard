# AgentGuard

[![GitHub stars](https://img.shields.io/github/stars/agent-guard/agent-guard?style=flat-square)](https://github.com/agent-guard/agent-guard)
[![License](https://img.shields.io/github/license/agent-guard/agent-guard?style=flat-square)](LICENSE)
[![PyPI](https://img.shields.io/pypi/v/agent-guard?style=flat-square)](https://pypi.org/project/agent-guard/)
[![NPM](https://img.shields.io/npm/v/@agent-guard/nestjs?style=flat-square)](https://www.npmjs.com/package/@agent-guard/nestjs)
[![CI](https://img.shields.io/github/actions/workflow/status/agent-guard/agent-guard/ci.yml?style=flat-square)](https://github.com/agent-guard/agent-guard/actions)

> Policy engine for securing AI agent tool calls. Supports Python (asyncio) and NestJS (Node.js).

## Features

- **Policy-based control** - Define rules in YAML for tool call interception
- **Risk argument blocking** - Regex-based blocking of dangerous inputs
- **Rate limiting** - Per-session rate limiting with ASK_HUMAN escalation
- **Sensitive data masking** - Automatic PII detection and redaction
- **Dual SDK** - Python and NestJS implementations with identical behavior
- **Suspension mechanism** - Async wait for human approval with timeout

## Repository Structure

```
agent-guard/
├── python/          # Python SDK (asyncio)
├── nestjs/          # NestJS SDK (Node.js)
├── policy.example.yaml
├── LICENSE
└── README.md
```

## Quick Start

### Python

```bash
cd python
pip install -e ".[dev]"
python ../examples/python_demo.py
```

### NestJS

```bash
cd nestjs
npm install
npm run test
```

## License

MIT
