import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export interface ServerConnection {
  client: Client;
  transport: Transport;
  close: () => Promise<void>;
}

/**
 * Parse a server specifier into a launch command.
 * Supports:
 *   - "node server.js"          → direct command
 *   - "npx pkg"                 → npx launch
 *   - "python server.py"        → python launch
 *   - "http://localhost:3000"   → SSE connection
 *   - "/path/to/server.js"      → auto-detect (node/python)
 */
export function parseServerSpec(server: string): { command: string; args: string[] } | { url: URL } {
  // SSE URL
  if (server.startsWith('http://') || server.startsWith('https://')) {
    return { url: new URL(server) };
  }

  // Explicit command
  if (server.includes(' ')) {
    const parts = server.split(/\s+/);
    return { command: parts[0], args: parts.slice(1) };
  }

  // Auto-detect by extension
  if (server.endsWith('.py')) {
    return { command: 'python', args: [server] };
  }

  // Default to node
  return { command: 'node', args: [server] };
}

/**
 * Connect to an MCP server and return a ready client.
 */
export async function connect(server: string, timeoutMs = 10000): Promise<ServerConnection> {
  const spec = parseServerSpec(server);

  let transport: Transport;

  if ('url' in spec) {
    transport = new SSEClientTransport(spec.url);
  } else {
    transport = new StdioClientTransport({
      command: spec.command,
      args: spec.args,
    });
  }

  const client = new Client(
    { name: 'mcp-toolkit', version: '1.0.0' },
    { capabilities: {} }
  );

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Connection timed out after ${timeoutMs}ms`)), timeoutMs)
  );

  await Promise.race([
    client.connect(transport),
    timeout,
  ]);

  return {
    client,
    transport,
    close: async () => {
      await client.close();
      await transport.close();
    },
  };
}

/**
 * Type-safe wrapper to list all server capabilities.
 */
export async function getServerInfo(client: Client) {
  const [tools, resources, prompts] = await Promise.allSettled([
    client.listTools(),
    client.listResources(),
    client.listPrompts(),
  ]);

  return {
    tools: tools.status === 'fulfilled' ? tools.value.tools : [],
    resources: resources.status === 'fulfilled' ? resources.value.resources : [],
    prompts: prompts.status === 'fulfilled' ? prompts.value.prompts : [],
  };
}
