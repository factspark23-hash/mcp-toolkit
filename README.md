<div align="center">

# 🔧 MCP Toolkit

### The Swiss Army Knife for Model Context Protocol Servers

**Test · Inspect · Scaffold · Discover · Monitor**

[![npm version](https://img.shields.io/npm/v/mcp-toolkit?style=flat-square&color=blue)](https://www.npmjs.com/package/mcp-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org)
[![GitHub stars](https://img.shields.io/github/stars/factspark23-hash/mcp-toolkit?style=flat-square)](https://github.com/factspark23-hash/mcp-toolkit/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/factspark23-hash/mcp-toolkit?style=flat-square)](https://github.com/factspark23-hash/mcp-toolkit/issues)

[Quick Start](#-quick-start) · [Commands](#-commands) · [Why MCP Toolkit?](#-why-mcp-toolkit) · [Contributing](#-contributing)

</div>

---

Building MCP servers? You know the pain:

- **No way to test** your server without writing a full client
- **No standard tool** to validate protocol compliance
- **Boilerplate hell** every time you start a new server
- **Finding servers** means digging through GitHub repos

**MCP Toolkit fixes all of that.** One CLI, five commands, zero friction.

## ⚡ Quick Start

```bash
# Install globally
npm install -g mcp-toolkit

# Test any MCP server
mcp-toolkit test npx @modelcontextprotocol/server-filesystem /tmp

# Interactive inspector
mcp-toolkit inspect npx @modelcontextprotocol/server-filesystem /tmp

# Scaffold a new server
mcp-toolkit scaffold my-server --language typescript

# Browse the registry
mcp-toolkit discover --category database

# Health check
mcp-toolkit health npx @modelcontextprotocol/server-memory
```

## 🎯 Commands

### `mcp-toolkit test` — Validate Everything

Runs a full compliance check on any MCP server:

```bash
mcp-toolkit test ./my-server.js
mcp-toolkit test npx @modelcontextprotocol/server-github
mcp-toolkit test python server.py
mcp-toolkit test http://localhost:3000
```

**What it checks:**
- ✅ Server starts and completes handshake
- ✅ Protocol version compatibility
- ✅ All tools have valid schemas
- ✅ Tools respond to calls
- ✅ Resources are readable
- ✅ Prompts return messages
- ✅ Response time benchmarks

**Output:**
```
Test Results
────────────────────────────────────────────────────────
  ✓ connection
  ✓ server-info          my-server v1.0.0
  ✓ capabilities         tools=3 resources=1 prompts=2
  ✓ tool:greet           Responded to empty call in 45ms
  ✓ tool:calculate       Schema validates required params
  ✓ resource:info://app  Readable — 1 content block(s)
  ✓ prompt:summarize     Returns 1 message(s)

────────────────────────────────────────────────────────
  7 passed
```

**JSON output for CI:**
```bash
mcp-toolkit test ./server.js --json | jq '.[] | select(.status == "fail")'
```

### `mcp-toolkit inspect` — Interactive Debugger

Browse and call tools, read resources, test prompts — all interactively:

```bash
mcp-toolkit inspect npx @modelcontextprotocol/server-filesystem /tmp
```

```
🔍 Interactive MCP Inspector

✓ Connected — 5 tools, 1 resources, 0 prompts

? What do you want to do? (Use arrow keys)
  🔧 Browse Tools (5)
  📦 Browse Resources (1)
  💬 Browse Prompts (0)
  📊 Server Info
  ─────────────
  🚔 Exit
```

### `mcp-toolkit scaffold` — Zero to Server in Seconds

Generate production-ready MCP server projects:

```bash
# TypeScript minimal
mcp-toolkit scaffold my-server --language typescript --template minimal

# Python full (with prompts, tests, etc.)
mcp-toolkit scaffold my-server --language python --template full

# Skip npm install
mcp-toolkit scaffold my-server --no-install
```

**Templates:**

| Language | Template | What's Included |
|----------|----------|----------------|
| TypeScript | `minimal` | Server, tool, resource, README |
| TypeScript | `full` | + prompts, tests, eslint, vitest |
| Python | `minimal` | Server, tool, resource, README |
| Python | `full` | + prompts, tests, pytest |

### `mcp-toolkit discover` — Server Registry

Find MCP servers from a curated, tested registry:

```bash
# Browse all
mcp-toolkit discover

# Search
mcp-toolkit discover --query filesystem

# Filter by category
mcp-toolkit discover --category database

# JSON output
mcp-toolkit discover --json
```

**Categories:** `filesystem` · `database` · `devtools` · `search` · `browser` · `api` · `ai` · `communication` · `web` · `reference`

### `mcp-toolkit health` — Monitor Servers

```bash
# One-time check
mcp-toolkit health ./my-server.js

# Continuous monitoring
mcp-toolkit health ./my-server.js --watch --interval 10
```

```
── Health Report ──
  Status:    ● HEALTHY
  Latency:   142ms
  Server:    my-server v1.0.0
  Tools:     3
  Resources: 1
  Prompts:   2
  Checked:   2026-04-23T15:30:00.000Z
```

## 🤔 Why MCP Toolkit?

| Feature | MCP Toolkit | Manual Testing | Other Tools |
|---------|-------------|----------------|-------------|
| Protocol compliance testing | ✅ Built-in | ❌ Write your own | ❌ None |
| Interactive inspector | ✅ REPL UI | ❌ Console.log | ⚠️ Web only |
| Server scaffolding | ✅ 4 templates | ❌ Copy-paste | ⚠️ Limited |
| Server registry | ✅ Curated | ❌ Search GitHub | ⚠️ Lists only |
| Health monitoring | ✅ Watch mode | ❌ Manual | ❌ None |
| CI/CD ready | ✅ JSON output | ❌ No | ⚠️ Partial |

## 🔌 Works With Everything

```bash
# Node.js servers
mcp-toolkit test ./dist/index.js

# Python servers
mcp-toolkit test python server.py

# npm packages
mcp-toolkit test npx @modelcontextprotocol/server-github

# Remote servers (SSE)
mcp-toolkit test http://localhost:3000

# Custom commands
mcp-toolkit test "docker run -i my-mcp-server"
```

## 🏗️ For CI/CD

Use `--json` flag for machine-readable output:

```bash
# In your CI pipeline
mcp-toolkit test ./server.js --json > test-results.json

# Fail build on any test failure
mcp-toolkit test ./server.js && echo "PASS" || echo "FAIL"
```

```yaml
# GitHub Actions example
- name: Test MCP Server
  run: |
    npm install -g mcp-toolkit
    mcp-toolkit test ./dist/index.js
```

## 📖 Programmatic API

```typescript
import { connect, getServerInfo } from 'mcp-toolkit';

const conn = await connect('./my-server.js');
const info = await getServerInfo(conn.client);

console.log(`Tools: ${info.tools.length}`);
console.log(`Resources: ${info.resources.length}`);

// Call a tool
const result = await conn.client.callTool({
  name: 'greet',
  arguments: { name: 'World' },
});

await conn.close();
```

## 🤝 Contributing

We love contributions! Here's how:

1. **Add a server to the registry** — Edit `src/commands/discover.ts`
2. **Add a scaffold template** — Edit `src/commands/scaffold.ts`
3. **Improve test coverage** — Add tests in `tests/`
4. **Report bugs** — [Open an issue](https://github.com/factspark23-hash/mcp-toolkit/issues)

```bash
# Development setup
git clone https://github.com/factspark23-hash/mcp-toolkit.git
cd mcp-toolkit
npm install
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📋 Roadmap

- [ ] Web UI for interactive inspection
- [ ] VS Code extension
- [ ] Server performance benchmarks
- [ ] Auto-generate client code from server
- [ ] Docker image for CI/CD
- [ ] More server templates (Rust, Go, Java)
- [ ] Server compatibility matrix

## ⭐ Star History

If MCP Toolkit helps you build better MCP servers, give it a star! ⭐

## 📄 License

MIT — use it however you want.

---

<div align="center">

**Built for the MCP ecosystem**

[Model Context Protocol](https://modelcontextprotocol.io) · [MCP Servers](https://github.com/modelcontextprotocol/servers) · [MCP Spec](https://spec.modelcontextprotocol.io)

</div>
