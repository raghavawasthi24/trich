import { Connection, WorkflowClient } from '@temporalio/client';
import { env } from '../config/env';
import { logger } from '../helpers/logger';

let connection: Connection | undefined;
let client: WorkflowClient | undefined;
let connecting: Promise<WorkflowClient> | undefined;

async function connect(): Promise<WorkflowClient> {
  connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS, connectTimeout: '3 seconds' });
  client = new WorkflowClient({ connection, namespace: env.TEMPORAL_NAMESPACE });
  return client;
}

export async function getTemporalClient(): Promise<WorkflowClient> {
  if (client) return client;
  if (!connecting) {
    connecting = connect().catch((err) => {
      connecting = undefined;
      throw err;
    });
  }
  return connecting;
}

export async function isTemporalHealthy(): Promise<boolean> {
  try {
    await getTemporalClient();
    return true;
  } catch {
    return false;
  }
}

export async function closeTemporalConnection(): Promise<void> {
  if (connection) {
    await connection.close().catch((err) => logger.warn({ err }, 'Error closing Temporal connection'));
    connection = undefined;
    client = undefined;
    connecting = undefined;
  }
}

/**
 * Test-only seam: lets integration tests point the singleton at a
 * WorkflowClient built from TestWorkflowEnvironment's nativeConnection
 * instead of dialing a real Temporal server.
 */
export function __setClientForTesting(overrideClient: WorkflowClient | undefined): void {
  client = overrideClient;
  connecting = undefined;
}
