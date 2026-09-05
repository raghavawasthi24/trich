import { Worker } from '@temporalio/worker';
import { env } from './config/env';
import { logger } from './helpers/logger';
import * as activities from './temporal/activities';

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./temporal/workflows'),
    activities,
    taskQueue: env.TEMPORAL_TASK_QUEUE,
    namespace: env.TEMPORAL_NAMESPACE,
    maxConcurrentActivityTaskExecutions: 20,
    shutdownGraceTime: '10s',
  });

  logger.info(`Worker polling task queue "${env.TEMPORAL_TASK_QUEUE}"`);
  await worker.run();
}

run().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
