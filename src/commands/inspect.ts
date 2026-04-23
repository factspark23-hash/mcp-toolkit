import chalk from 'chalk';
import inquirer from 'inquirer';
import { connect, getServerInfo, type ServerConnection } from '../utils/client.js';

interface InspectOptions {
  command?: string;
}

export async function inspectCommand(server: string, opts: InspectOptions) {
  console.log(chalk.bold('🔍 Interactive MCP Inspector\n'));

  const conn = await connect(server);
  const info = await getServerInfo(conn.client);

  console.log(chalk.green(`✓ Connected — ${info.tools.length} tools, ${info.resources.length} resources, ${info.prompts.length} prompts\n`));

  try {
    await mainLoop(conn, info);
  } finally {
    await conn.close();
    console.log(chalk.dim('\nDisconnected.'));
  }
}

async function mainLoop(
  conn: ServerConnection,
  info: { tools: any[]; resources: any[]; prompts: any[] }
) {
  while (true) {
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What do you want to do?',
      choices: [
        { name: `🔧 Browse Tools (${info.tools.length})`, value: 'tools' },
        { name: `📦 Browse Resources (${info.resources.length})`, value: 'resources' },
        { name: `💬 Browse Prompts (${info.prompts.length})`, value: 'prompts' },
        { name: '📊 Server Info', value: 'info' },
        new inquirer.Separator(),
        { name: '🚪 Exit', value: 'exit' },
      ],
    }]);

    switch (action) {
      case 'tools':
        await browseTools(conn, info.tools);
        break;
      case 'resources':
        await browseResources(conn, info.resources);
        break;
      case 'prompts':
        await browsePrompts(conn, info.prompts);
        break;
      case 'info':
        showServerInfo(conn);
        break;
      case 'exit':
        return;
    }
  }
}

async function browseTools(conn: ServerConnection, tools: any[]) {
  if (tools.length === 0) {
    console.log(chalk.yellow('\nNo tools available.\n'));
    return;
  }

  const choices = tools.map(t => ({
    name: `${t.name}${t.description ? chalk.dim(` — ${t.description.slice(0, 60)}`) : ''}`,
    value: t.name,
  }));
  choices.push({ name: chalk.dim('← Back'), value: '__back' });

  const { toolName } = await inquirer.prompt([{
    type: 'list',
    name: 'toolName',
    message: 'Select a tool to inspect:',
    choices,
    pageSize: 15,
  }]);

  if (toolName === '__back') return;

  const tool = tools.find(t => t.name === toolName)!;

  console.log(chalk.bold(`\n── ${tool.name} ──`));
  console.log(chalk.dim(tool.description || 'No description'));
  console.log(chalk.bold('\nInput Schema:'));
  console.log(JSON.stringify(tool.inputSchema, null, 2));

  // Ask if user wants to call it
  const { doCall } = await inquirer.prompt([{
    type: 'confirm',
    name: 'doCall',
    message: `Call "${tool.name}"?`,
    default: true,
  }]);

  if (!doCall) return;

  // Collect arguments
  const args = await collectArgs(tool.inputSchema);

  console.log(chalk.dim('\nCalling...'));
  try {
    const result = await conn.client.callTool({ name: tool.name, arguments: args });
    console.log(chalk.bold('\n── Response ──'));

    if (result.content && Array.isArray(result.content)) {
      for (const block of result.content) {
        if (block.type === 'text') {
          console.log(block.text);
        } else if (block.type === 'image') {
          console.log(chalk.cyan(`[Image: ${block.mimeType}]`));
        } else {
          console.log(JSON.stringify(block, null, 2));
        }
      }
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    console.log('');
  } catch (err: any) {
    console.log(chalk.red(`\nError: ${err.message}\n`));
  }
}

async function browseResources(conn: ServerConnection, resources: any[]) {
  if (resources.length === 0) {
    console.log(chalk.yellow('\nNo resources available.\n'));
    return;
  }

  const choices = resources.map(r => ({
    name: `${r.uri}${r.name ? chalk.dim(` — ${r.name}`) : ''}`,
    value: r.uri,
  }));
  choices.push({ name: chalk.dim('← Back'), value: '__back' });

  const { uri } = await inquirer.prompt([{
    type: 'list',
    name: 'uri',
    message: 'Select a resource:',
    choices,
    pageSize: 15,
  }]);

  if (uri === '__back') return;

  console.log(chalk.dim('\nReading...'));
  try {
    const result = await conn.client.readResource({ uri });
    console.log(chalk.bold('\n── Resource Content ──'));
    for (const content of result.contents) {
      if ('text' in content && content.text) {
        console.log(content.text.slice(0, 2000));
        if (content.text.length > 2000) {
          console.log(chalk.dim(`\n... (${content.text.length - 2000} more characters)`));
        }
      } else if ('blob' in content && content.blob) {
        console.log(chalk.cyan(`[Binary blob: ${content.mimeType || 'unknown'}]`));
      }
    }
    console.log('');
  } catch (err: any) {
    console.log(chalk.red(`\nError: ${err.message}\n`));
  }
}

async function browsePrompts(conn: ServerConnection, prompts: any[]) {
  if (prompts.length === 0) {
    console.log(chalk.yellow('\nNo prompts available.\n'));
    return;
  }

  const choices = prompts.map(p => ({
    name: `${p.name}${p.description ? chalk.dim(` — ${p.description.slice(0, 60)}`) : ''}`,
    value: p.name,
  }));
  choices.push({ name: chalk.dim('← Back'), value: '__back' });

  const { promptName } = await inquirer.prompt([{
    type: 'list',
    name: 'promptName',
    message: 'Select a prompt:',
    choices,
  }]);

  if (promptName === '__back') return;

  const prompt = prompts.find((p: any) => p.name === promptName)!;

  // Collect arguments if needed
  const args: Record<string, string> = {};
  if (prompt.arguments && prompt.arguments.length > 0) {
    for (const arg of prompt.arguments) {
      const { value } = await inquirer.prompt([{
        type: 'input',
        name: 'value',
        message: `${arg.name}${arg.required ? ' (required)' : ''}:`,
        default: arg.description || '',
      }]);
      if (value) args[arg.name] = value;
    }
  }

  try {
    const result = await conn.client.getPrompt({ name: promptName, arguments: args });
    console.log(chalk.bold('\n── Prompt Messages ──'));
    for (const msg of result.messages) {
      console.log(chalk.cyan(`[${msg.role}]`), msg.content);
    }
    console.log('');
  } catch (err: any) {
    console.log(chalk.red(`\nError: ${err.message}\n`));
  }
}

function showServerInfo(conn: ServerConnection) {
  const version = conn.client.getServerVersion();
  const caps = conn.client.getServerCapabilities();

  console.log(chalk.bold('\n── Server Info ──'));
  console.log(`  Name:    ${version?.name || 'unknown'}`);
  console.log(`  Version: ${version?.version || 'unknown'}`);
  console.log(`  Protocol: MCP`);
  console.log(chalk.bold('\n  Capabilities:'));
  console.log(JSON.stringify(caps, null, 2));
  console.log('');
}

async function collectArgs(schema: any): Promise<Record<string, any>> {
  if (!schema?.properties || Object.keys(schema.properties).length === 0) {
    return {};
  }

  const args: Record<string, any> = {};
  const required = schema.required || [];

  for (const [key, prop] of Object.entries<any>(schema.properties)) {
    const isRequired = required.includes(key);
    const label = `${key}${prop.description ? ` (${prop.description})` : ''}${isRequired ? ' *' : ''}`;

    if (prop.type === 'boolean') {
      const { val } = await inquirer.prompt([{
        type: 'confirm',
        name: 'val',
        message: label,
        default: prop.default ?? false,
      }]);
      args[key] = val;
    } else if (prop.enum) {
      const { val } = await inquirer.prompt([{
        type: 'list',
        name: 'val',
        message: label,
        choices: prop.enum,
      }]);
      args[key] = val;
    } else {
      const { val } = await inquirer.prompt([{
        type: 'input',
        name: 'val',
        message: label,
      }]);
      if (val !== '') {
        args[key] = prop.type === 'number' ? Number(val) : val;
      }
    }
  }

  return args;
}
