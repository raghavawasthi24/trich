import { env } from './config/env';
import { createApp } from './app';
import { logger } from './helpers/logger';
import { closeTemporalConnection } from './services/temporalClient.service';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on port ${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down API`);
  server.close(async () => {
    await closeTemporalConnection();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
