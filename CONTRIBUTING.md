# Contributing to AgentGuard

## Local Development

### Python SDK

```bash
cd python
pip install -e ".[dev]"
pytest
```

### NestJS SDK

```bash
cd nestjs
npm install
npm run test
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Code Style

- Python: Follow PEP 8, use type hints
- TypeScript: Use strict mode, follow NestJS conventions

## Testing

- Ensure all tests pass before submitting PR
- Python: `pytest --cov --cov-fail-under=80`
- NestJS: `npm run test:cov`
- Coverage must be >= 80%
