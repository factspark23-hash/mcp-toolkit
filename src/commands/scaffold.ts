import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';

interface ScaffoldOptions {
  language: string;
  template: string;
  install: boolean;
}

const TEMPLATES: Record<string, Record<string, (name: string) => Record<string, string>>> = {
  typescript: {
    minimal: TS_MINIMAL,
    full: TS_FULL,
  },
  python: {
    minimal: PY_MINIMAL,
    full: PY_FULL,
  },
};

export async function scaffoldCommand(name: string, opts: ScaffoldOptions) {
  console.log(chalk.bold(`🏗️  Scaffolding MCP server: ${name}\n`));

  const lang = opts.language;
  const tmpl = opts.template;

  if (!TEMPLATES[lang]) {
    console.log(chalk.red(`Unknown language: ${lang}. Use "typescript" or "python".`));
    process.exit(1);
  }
  if (!TEMPLATES[lang][tmpl]) {
    console.log(chalk.red(`Unknown template: ${tmpl}. Use "minimal" or "full".`));
    process.exit(1);
  }

  const projectDir = path.resolve(process.cwd(), name);

  // Check if directory exists
  try {
    await fs.access(projectDir);
    console.log(chalk.red(`Directory "${name}" already exists.`));
    process.exit(1);
  } catch {
    // Good — doesn't exist
  }

  const spinner = ora('Creating project structure...').start();

  await fs.mkdir(projectDir, { recursive: true });

  const files = TEMPLATES[lang][tmpl](name);

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(projectDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content as string, 'utf-8');
  }

  spinner.succeed('Project created');

  // Install dependencies
  if (opts.install) {
    const installSpinner = ora('Installing dependencies...').start();
    try {
      if (lang === 'typescript') {
        await execa('npm', ['install'], { cwd: projectDir });
      } else {
        await execa('pip', ['install', '-r', 'requirements.txt'], { cwd: projectDir });
      }
      installSpinner.succeed('Dependencies installed');
    } catch (err: any) {
      installSpinner.fail(`Install failed: ${err.message}`);
      console.log(chalk.dim('Run install manually later.'));
    }
  }

  console.log(chalk.bold('\n── Next Steps ──'));
  console.log(`  cd ${name}`);
  if (lang === 'typescript') {
    console.log('  npm run build');
    console.log('  node dist/index.js');
  } else {
    console.log('  python server.py');
  }
  console.log(`\n  ${chalk.cyan('mcp-toolkit test')} ./${lang === 'typescript' ? 'dist/index.js' : 'server.py'}`);
  console.log('');
}

// ──────────────────────────────────────────────
// TypeScript Templates
// ──────────────────────────────────────────────

function TS_MINIMAL(name: string): Record<string, string> {
  return {
    'package.json': JSON.stringify({
      name,
      version: '0.1.0',
      type: 'module',
      main: 'dist/index.js',
      scripts: {
        build: 'tsc',
        dev: 'tsc --watch',
        start: 'node dist/index.js',
      },
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.12.1',
        zod: '^3.24.2',
      },
      devDependencies: {
        '@types/node': '^22.14.0',
        typescript: '^5.8.3',
      },
    }, null, 2),

    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'Node16',
        moduleResolution: 'Node16',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        declaration: true,
      },
      include: ['src/**/*'],
    }, null, 2),

    'src/index.ts': `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: '${name}',
  version: '0.1.0',
});

// ── Example Tool ──
server.tool(
  'greet',
  'Greet someone by name',
  { name: z.string().describe('Name to greet') },
  async ({ name }) => ({
    content: [{ type: 'text', text: \`Hello, \${name}! 👋\` }],
  })
);

// ── Example Resource ──
server.resource(
  'info',
  'info://server',
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({ name: '${name}', version: '0.1.0' }, null, 2),
    }],
  })
);

// ── Start ──
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('${name} MCP server running on stdio');
}

main().catch(console.error);
`,

    'README.md': `# ${name}

A Model Context Protocol (MCP) server.

## Setup

\`\`\`bash
npm install
npm run build
\`\`\`

## Usage

\`\`\`bash
node dist/index.js
\`\`\`

## Test with MCP Toolkit

\`\`\`bash
mcp-toolkit test ./dist/index.js
mcp-toolkit inspect ./dist/index.js
\`\`\`
`,

    '.gitignore': 'node_modules/\ndist/\n.env\n',
  };
}

function TS_FULL(name: string): Record<string, string> {
  const minimal = TS_MINIMAL(name);

  minimal['src/index.ts'] = `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: '${name}',
  version: '0.1.0',
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
  },
});

// ── Tools ──
server.tool(
  'echo',
  'Echo back the input text',
  { text: z.string().describe('Text to echo') },
  async ({ text }) => ({
    content: [{ type: 'text', text }],
  })
);

server.tool(
  'calculate',
  'Evaluate a mathematical expression',
  {
    expression: z.string().describe('Math expression, e.g. "2 + 2"'),
  },
  async ({ expression }) => {
    try {
      // Safe math evaluation (no eval)
      const result = safeCalc(expression);
      return { content: [{ type: 'text', text: String(result) }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: \`Error: \${err.message}\` }], isError: true };
    }
  }
);

// ── Resources ──
server.resource(
  'config',
  'config://app',
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        name: '${name}',
        version: '0.1.0',
        description: 'A full-featured MCP server',
      }, null, 2),
    }],
  })
);

// ── Prompts ──
server.prompt(
  'summarize',
  'Summarize text in a specific style',
  {
    text: z.string().describe('Text to summarize'),
    style: z.enum(['brief', 'detailed', 'bullet-points']).optional().describe('Summary style'),
  },
  async ({ text, style }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: \`Summarize the following in \${style || 'brief'} style:\\n\\n\${text}\`,
      },
    }],
  })
);

// ── Safe Math ──
function safeCalc(expr: string): number {
  const sanitized = expr.replace(/[^0-9+\\-*/().%\\s]/g, '');
  if (!sanitized) throw new Error('Invalid expression');
  const fn = new Function(\`"use strict"; return (\${sanitized})\`);
  return fn();
}

// ── Start ──
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('${name} MCP server running on stdio');
}

main().catch(console.error);
`;

  minimal['src/index.ts'] = minimal['src/index.ts']!;

  minimal['.env.example'] = `# Add your environment variables here
# API_KEY=your-key-here
`;

  minimal['vitest.config.ts'] = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 10000,
  },
});
`;

  minimal['tests/server.test.ts'] = `import { describe, it, expect } from 'vitest';

describe('${name}', () => {
  it('should be importable', async () => {
    // Add your tests here
    expect(true).toBe(true);
  });
});
`;

  minimal['package.json'] = JSON.stringify({
    ...JSON.parse(minimal['package.json']),
    scripts: {
      build: 'tsc',
      dev: 'tsc --watch',
      start: 'node dist/index.js',
      test: 'vitest run',
      lint: 'eslint src/',
    },
    devDependencies: {
      ...JSON.parse(minimal['package.json']).devDependencies,
      vitest: '^3.1.1',
      eslint: '^9.24.0',
    },
  }, null, 2);

  return minimal;
}

// ──────────────────────────────────────────────
// Python Templates
// ──────────────────────────────────────────────

function PY_MINIMAL(name: string): Record<string, string> {
  return {
    'pyproject.toml': `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "${name}"
version = "0.1.0"
description = "A Model Context Protocol server"
requires-python = ">=3.10"
dependencies = [
    "mcp>=1.0.0",
]

[project.scripts]
${name.replace(/-/g, '_')} = "${name.replace(/-/g, '_')}:main"
`,

    'server.py': `#!/usr/bin/env python3
"""${name} — A Model Context Protocol server."""

import json
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    TextContent,
    Tool,
    Resource,
)

server = Server("${name}")


@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="greet",
            description="Greet someone by name",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name to greet"},
                },
                "required": ["name"],
            },
        )
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "greet":
        return [TextContent(type="text", text=f"Hello, {arguments['name']}! 👋")]
    raise ValueError(f"Unknown tool: {name}")


@server.list_resources()
async def list_resources():
    return [
        Resource(
            uri="info://server",
            name="Server Info",
            description="Basic server information",
        )
    ]


@server.read_resource()
async def read_resource(uri: str):
    if uri == "info://server":
        return json.dumps({"name": "${name}", "version": "0.1.0"}, indent=2)
    raise ValueError(f"Unknown resource: {uri}")


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
`,

    'requirements.txt': 'mcp>=1.0.0\n',

    'README.md': `# ${name}

A Model Context Protocol (MCP) server in Python.

## Setup

\`\`\`bash
pip install -r requirements.txt
\`\`\`

## Usage

\`\`\`bash
python server.py
\`\`\`

## Test with MCP Toolkit

\`\`\`bash
mcp-toolkit test python server.py
mcp-toolkit inspect python server.py
\`\`\`
`,

    '.gitignore': '__pycache__/\n*.pyc\n.env\nvenv/\n',
  };
}

function PY_FULL(name: string): Record<string, string> {
  const minimal = PY_MINIMAL(name);

  minimal['server.py'] = `#!/usr/bin/env python3
"""${name} — A full-featured Model Context Protocol server."""

import json
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    TextContent,
    Tool,
    Resource,
    Prompt,
    PromptMessage,
)

server = Server("${name}")


# ── Tools ──

@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="echo",
            description="Echo back the input text",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text to echo"},
                },
                "required": ["text"],
            },
        ),
        Tool(
            name="calculate",
            description="Evaluate a mathematical expression",
            inputSchema={
                "type": "object",
                "properties": {
                    "expression": {"type": "string", "description": "Math expression"},
                },
                "required": ["expression"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "echo":
        return [TextContent(type="text", text=arguments["text"])]
    elif name == "calculate":
        try:
            result = safe_calc(arguments["expression"])
            return [TextContent(type="text", text=str(result))]
        except Exception as e:
            return [TextContent(type="text", text=f"Error: {e}")]
    raise ValueError(f"Unknown tool: {name}")


def safe_calc(expr: str) -> float:
    import re
    sanitized = re.sub(r"[^0-9+\\-*/().%\\s]", "", expr)
    if not sanitized:
        raise ValueError("Invalid expression")
    return eval(sanitized, {"__builtins__": {}})


# ── Resources ──

@server.list_resources()
async def list_resources():
    return [
        Resource(
            uri="config://app",
            name="App Config",
            description="Server configuration",
        )
    ]


@server.read_resource()
async def read_resource(uri: str):
    if uri == "config://app":
        return json.dumps({
            "name": "${name}",
            "version": "0.1.0",
            "description": "A full-featured MCP server",
        }, indent=2)
    raise ValueError(f"Unknown resource: {uri}")


# ── Prompts ──

@server.list_prompts()
async def list_prompts():
    return [
        Prompt(
            name="summarize",
            description="Summarize text in a specific style",
            arguments=[
                {"name": "text", "description": "Text to summarize", "required": True},
                {"name": "style", "description": "brief | detailed | bullet-points", "required": False},
            ],
        )
    ]


@server.get_prompt()
async def get_prompt(name: str, arguments: dict):
    if name == "summarize":
        style = arguments.get("style", "brief")
        text = arguments.get("text", "")
        return {
            "messages": [
                PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=f"Summarize the following in {style} style:\\n\\n{text}",
                    ),
                )
            ]
        }
    raise ValueError(f"Unknown prompt: {name}")


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
`;

  minimal['tests/test_server.py'] = `"""Tests for ${name}."""
import pytest

def test_import():
    """Basic import test."""
    import server
    assert hasattr(server, 'server')
`;

  minimal['pyproject.toml'] = `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "${name}"
version = "0.1.0"
description = "A full-featured Model Context Protocol server"
requires-python = ">=3.10"
dependencies = [
    "mcp>=1.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
]
`;

  return minimal;
}
