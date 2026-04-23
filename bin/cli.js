#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { testCommand } from '../src/commands/test.js';
import { inspectCommand } from '../src/commands/inspect.js';
import { scaffoldCommand } from '../src/commands/scaffold.js';
import { discoverCommand } from '../src/commands/discover.js';
import { healthCommand } from '../src/commands/health.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

console.log(
  chalk.bold.cyan('\n🔧 MCP Toolkit') +
  chalk.dim(` v${pkg.version}\n`)
);

program
  .name('mcp-toolkit')
  .description('Swiss Army Knife for MCP Servers — Test, Debug, Scaffold & Discover')
  .version(pkg.version);

program
  .command('test')
  .description('Test an MCP server — validate tools, resources, prompts & protocol compliance')
  .argument('<server>', 'Path to server script or npm package (e.g. "npx @modelcontextprotocol/server-filesystem")')
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '10000')
  .option('-v, --verbose', 'Show full request/response payloads')
  .option('--json', 'Output results as JSON')
  .action(testCommand);

program
  .command('inspect')
  .description('Interactive inspector — browse tools, call them, see responses in real-time')
  .argument('<server>', 'Path to server script or npm package')
  .option('-c, --command <cmd>', 'Command to launch server (auto-detected if omitted)')
  .action(inspectCommand);

program
  .command('scaffold')
  .description('Generate a new MCP server project from templates')
  .argument('[name]', 'Project name', 'my-mcp-server')
  .option('-l, --language <lang>', 'Language: typescript | python', 'typescript')
  .option('-t, --template <tmpl>', 'Template: minimal | full | auth', 'minimal')
  .option('--no-install', 'Skip npm/pip install')
  .action(scaffoldCommand);

program
  .command('discover')
  .description('Browse and search the MCP server registry')
  .option('-q, --query <search>', 'Search servers by name or description')
  .option('-c, --category <cat>', 'Filter by category')
  .option('--json', 'Output as JSON')
  .action(discoverCommand);

program
  .command('health')
  .description('Health check — verify MCP server is running and responsive')
  .argument('<server>', 'Path to server script or npm package')
  .option('-w, --watch', 'Continuously monitor health')
  .option('-i, --interval <sec>', 'Watch interval in seconds', '5')
  .action(healthCommand);

program.parse();
