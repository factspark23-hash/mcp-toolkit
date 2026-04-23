# Contributing to MCP Toolkit

Thanks for your interest in contributing! 🎉

## Getting Started

```bash
git clone https://github.com/factspark23-hash/mcp-toolkit.git
cd mcp-toolkit
npm install
npm run build
```

## Development

```bash
# Watch mode
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

## What to Contribute

### 🏆 High Priority
- **New scaffold templates** — Add templates for Rust, Go, Java
- **Server registry entries** — Add tested MCP servers to `src/commands/discover.ts`
- **Test improvements** — More compliance checks in `src/commands/test.ts`

### 🐛 Bug Fixes
- Check [open issues](https://github.com/factspark23-hash/mcp-toolkit/issues)
- Fix edge cases in server connection handling

### ✨ Features
- Web UI for interactive inspection
- VS Code extension
- Performance benchmarks
- Auto-generate client code from server schemas

## Pull Request Process

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run typecheck: `npm run typecheck`
6. Commit with a clear message
7. Push and open a PR

## Code Style

- TypeScript with strict mode
- Use `chalk` for terminal colors
- Use `ora` for spinners
- Use `inquirer` for interactive prompts
- Keep commands in `src/commands/`
- Keep utilities in `src/utils/`

## Adding a Server to the Registry

Edit `src/commands/discover.ts` and add an entry:

```typescript
{
  name: 'package-name',
  description: 'What it does',
  author: 'Author',
  category: 'devtools',
  install: 'npx package-name',
  stars: 500,
  url: 'https://github.com/...',
  verified: true,  // set true if you've tested it
}
```

## Questions?

Open an issue or start a discussion!
