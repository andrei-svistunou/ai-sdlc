import { buildApp } from './app.js';

const app = buildApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  app.log.info({ signal }, 'shutting down API');

  try {
    await app.close();
  } catch (error) {
    app.log.error({ err: error }, 'API shutdown failed');
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

async function start(): Promise<void> {
  try {
    await app.listen({ host, port });
  } catch (error) {
    app.log.error({ err: error }, 'API failed to start');
    process.exitCode = 1;
  }
}

void start();
