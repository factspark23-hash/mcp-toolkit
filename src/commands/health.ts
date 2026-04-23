import chalk from 'chalk';
import ora from 'ora';
import { connect, getServerInfo } from '../utils/client.js';

interface HealthOptions {
  watch: boolean;
  interval: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  tools: number;
  resources: number;
  prompts: number;
  serverName?: string;
  serverVersion?: string;
  timestamp: string;
}

export async function healthCommand(server: string, opts: HealthOptions) {
  if (opts.watch) {
    await watchHealth(server, parseInt(opts.interval, 10));
  } else {
    await singleCheck(server);
  }
}

async function singleCheck(server: string) {
  const spinner = ora('Checking server health...').start();
  const start = Date.now();

  try {
    const conn = await connect(server, 10000);
    const latency = Date.now() - start;
    const info = await getServerInfo(conn.client);
    const version = conn.client.getServerVersion();

    await conn.close();

    const status: HealthStatus = {
      status: latency < 2000 ? 'healthy' : 'degraded',
      latency,
      tools: info.tools.length,
      resources: info.resources.length,
      prompts: info.prompts.length,
      serverName: version?.name,
      serverVersion: version?.version,
      timestamp: new Date().toISOString(),
    };

    spinner.succeed('Health check complete');

    printHealth(status);
  } catch (err: any) {
    spinner.fail('Server is down');
    const status: HealthStatus = {
      status: 'down',
      latency: Date.now() - start,
      tools: 0,
      resources: 0,
      prompts: 0,
      timestamp: new Date().toISOString(),
    };
    printHealth(status, err.message);
    process.exit(1);
  }
}

async function watchHealth(server: string, intervalSec: number) {
  console.log(chalk.bold(`🏥 Health Monitor — checking every ${intervalSec}s (Ctrl+C to stop)\n`));

  while (true) {
    const start = Date.now();
    try {
      const conn = await connect(server, 5000);
      const latency = Date.now() - start;
      const info = await getServerInfo(conn.client);
      await conn.close();

      const icon = latency < 1000 ? chalk.green('●') : latency < 2000 ? chalk.yellow('●') : chalk.red('●');
      const time = new Date().toLocaleTimeString();
      console.log(
        `${icon} ${chalk.dim(time)}  ` +
        `${chalk.bold('UP')}  ` +
        `latency=${latency}ms  ` +
        `tools=${info.tools.length}  ` +
        `resources=${info.resources.length}`
      );
    } catch (err: any) {
      const time = new Date().toLocaleTimeString();
      console.log(`${chalk.red('●')} ${chalk.dim(time)}  ${chalk.red.bold('DOWN')}  ${err.message}`);
    }

    await new Promise(r => setTimeout(r, intervalSec * 1000));
  }
}

function printHealth(status: HealthStatus, error?: string) {
  const statusIcon = status.status === 'healthy' ? chalk.green('● HEALTHY')
    : status.status === 'degraded' ? chalk.yellow('● DEGRADED')
    : chalk.red('● DOWN');

  console.log('\n' + chalk.bold('── Health Report ──'));
  console.log(`  Status:    ${statusIcon}`);
  console.log(`  Latency:   ${status.latency}ms`);

  if (status.serverName) {
    console.log(`  Server:    ${status.serverName} v${status.serverVersion}`);
  }

  console.log(`  Tools:     ${status.tools}`);
  console.log(`  Resources: ${status.resources}`);
  console.log(`  Prompts:   ${status.prompts}`);
  console.log(`  Checked:   ${status.timestamp}`);

  if (error) {
    console.log(`  Error:     ${chalk.red(error)}`);
  }

  console.log('');
}
