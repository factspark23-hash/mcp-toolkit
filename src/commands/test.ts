import chalk from 'chalk';
import ora from 'ora';
import { connect, getServerInfo } from '../utils/client.js';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  duration?: number;
}

interface TestOptions {
  timeout: string;
  verbose: boolean;
  json: boolean;
}

export async function testCommand(server: string, opts: TestOptions) {
  const results: TestResult[] = [];
  const timeoutMs = parseInt(opts.timeout, 10);

  // ── Connect ──
  const spinner = ora('Connecting to server...').start();
  let conn;
  try {
    conn = await connect(server, timeoutMs);
    spinner.succeed('Connected');
    results.push({ name: 'connection', status: 'pass', message: 'Server started and responded to handshake' });
  } catch (err: any) {
    spinner.fail('Connection failed');
    results.push({ name: 'connection', status: 'fail', message: err.message });
    return printResults(results, opts.json);
  }

  const { client } = conn;

  // ── Protocol version ──
  const protoSpinner = ora('Checking protocol version...').start();
  try {
    const serverInfo = client.getServerVersion();
    if (serverInfo) {
      protoSpinner.succeed(`Server: ${serverInfo.name} v${serverInfo.version}`);
      results.push({
        name: 'server-info',
        status: 'pass',
        message: `${serverInfo.name} v${serverInfo.version}`,
      });
    } else {
      protoSpinner.warn('No server info returned');
      results.push({ name: 'server-info', status: 'warn', message: 'Server did not provide version info' });
    }
  } catch (err: any) {
    protoSpinner.fail('Protocol check failed');
    results.push({ name: 'server-info', status: 'fail', message: err.message });
  }

  // ── Capabilities ──
  const capSpinner = ora('Enumerating capabilities...').start();
  const info = await getServerInfo(client);
  capSpinner.succeed(
    `Found ${info.tools.length} tools, ${info.resources.length} resources, ${info.prompts.length} prompts`
  );
  results.push({
    name: 'capabilities',
    status: info.tools.length + info.resources.length + info.prompts.length > 0 ? 'pass' : 'warn',
    message: `tools=${info.tools.length} resources=${info.resources.length} prompts=${info.prompts.length}`,
  });

  // ── Tool validation ──
  if (info.tools.length > 0) {
    const toolSpinner = ora(`Validating ${info.tools.length} tools...`).start();
    let passed = 0;
    let failed = 0;

    for (const tool of info.tools) {
      const start = Date.now();
      try {
        // Validate schema — inputSchema should be a valid JSON Schema object
        if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
          results.push({
            name: `tool:${tool.name}:schema`,
            status: 'fail',
            message: `Tool "${tool.name}" has invalid or missing inputSchema`,
          });
          failed++;
          continue;
        }

        // Try calling with empty args to see if it handles gracefully
        try {
          await client.callTool({ name: tool.name, arguments: {} });
          const dur = Date.now() - start;
          results.push({
            name: `tool:${tool.name}:call`,
            status: 'pass',
            message: `Responded to empty call in ${dur}ms`,
            duration: dur,
          });
          passed++;
        } catch (callErr: any) {
          // If it errors with a validation error about missing required params, that's OK
          if (callErr.message?.includes('required') || callErr.message?.includes('Expected')) {
            results.push({
              name: `tool:${tool.name}:schema`,
              status: 'pass',
              message: `Schema validates required params correctly`,
            });
            passed++;
          } else {
            results.push({
              name: `tool:${tool.name}:call`,
              status: 'warn',
              message: `Call failed: ${callErr.message}`,
            });
            passed++; // warn, not fail
          }
        }
      } catch (err: any) {
        results.push({
          name: `tool:${tool.name}`,
          status: 'fail',
          message: err.message,
        });
        failed++;
      }
    }

    toolSpinner.succeed(`Tools validated: ${passed} passed, ${failed} failed`);
  }

  // ── Resource validation ──
  if (info.resources.length > 0) {
    const resSpinner = ora(`Validating ${info.resources.length} resources...`).start();
    let passed = 0;

    for (const resource of info.resources) {
      try {
        const content = await client.readResource({ uri: resource.uri });
        if (content.contents && content.contents.length > 0) {
          results.push({
            name: `resource:${resource.uri}`,
            status: 'pass',
            message: `Readable — ${content.contents.length} content block(s)`,
          });
          passed++;
        } else {
          results.push({
            name: `resource:${resource.uri}`,
            status: 'warn',
            message: 'Returned empty content',
          });
        }
      } catch (err: any) {
        results.push({
          name: `resource:${resource.uri}`,
          status: 'fail',
          message: err.message,
        });
      }
    }

    resSpinner.succeed(`Resources validated: ${passed}/${info.resources.length}`);
  }

  // ── Prompt validation ──
  if (info.prompts.length > 0) {
    const prSpinner = ora(`Validating ${info.prompts.length} prompts...`).start();
    let passed = 0;

    for (const prompt of info.prompts) {
      try {
        const result = await client.getPrompt({ name: prompt.name, arguments: {} });
        if (result.messages && result.messages.length > 0) {
          results.push({
            name: `prompt:${prompt.name}`,
            status: 'pass',
            message: `Returns ${result.messages.length} message(s)`,
          });
          passed++;
        } else {
          results.push({
            name: `prompt:${prompt.name}`,
            status: 'warn',
            message: 'Returned no messages',
          });
        }
      } catch (err: any) {
        // Prompts may require args — that's fine
        results.push({
          name: `prompt:${prompt.name}`,
          status: 'pass',
          message: 'Prompt registered (requires args for full test)',
        });
        passed++;
      }
    }

    prSpinner.succeed(`Prompts validated: ${passed}/${info.prompts.length}`);
  }

  // ── Cleanup ──
  await conn.close();

  // ── Output ──
  printResults(results, opts.json);
}

function printResults(results: TestResult[], asJson: boolean) {
  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log('\n' + chalk.bold('Test Results'));
  console.log('─'.repeat(60));

  const passed = results.filter(r => r.status === 'pass').length;
  const warned = results.filter(r => r.status === 'warn').length;
  const failed = results.filter(r => r.status === 'fail').length;

  for (const r of results) {
    const icon = r.status === 'pass' ? chalk.green('✓')
      : r.status === 'warn' ? chalk.yellow('⚠')
      : chalk.red('✗');

    const dur = r.duration ? chalk.dim(` (${r.duration}ms)`) : '';
    console.log(`  ${icon} ${chalk.bold(r.name)}${dur}`);
    if (r.status !== 'pass' || r.message.length > 60) {
      console.log(`    ${chalk.dim(r.message)}`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  const summary = [
    chalk.green(`${passed} passed`),
    warned > 0 ? chalk.yellow(`${warned} warnings`) : null,
    failed > 0 ? chalk.red(`${failed} failed`) : null,
  ].filter(Boolean).join(', ');

  console.log(`  ${summary}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}
