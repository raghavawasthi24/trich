import { WorkflowIdReusePolicy } from '@temporalio/client';
import { getTemporalClient } from './temporalClient.service';
import { hotelSearchWorkflow, getStatusQuery } from '../temporal/workflows';
import { SearchRequest } from '../schemas/search.schema';
import { SearchWorkflowInput, WorkflowSearchResult } from '../types/api.types';
import { canonicalKey, sha1 } from '../helpers/hash';
import { withTimeout, isTimeoutSentinel } from '../helpers/withTimeout';
import { env } from '../config/env';
import { logger } from '../helpers/logger';

export interface SearchCtx {
  requestId: string;
  scenario?: string;
  abortSignal: AbortSignal;
}

export type SearchOutcome =
  | { kind: 'done'; workflowId: string; result: WorkflowSearchResult }
  | { kind: 'pending'; workflowId: string };

const HTTP_GUARD_MS = 12_000;

export function workflowIdFor(input: SearchRequest): string {
  return `search:${sha1(canonicalKey(input))}`;
}

export async function search(input: SearchRequest, ctx: SearchCtx): Promise<SearchOutcome> {
  const client = await getTemporalClient();
  const workflowId = workflowIdFor(input);

  const workflowInput: SearchWorkflowInput = { ...input, scenario: ctx.scenario, requestId: ctx.requestId };

  const handle = await client.start(hotelSearchWorkflow, {
    workflowId,
    taskQueue: env.TEMPORAL_TASK_QUEUE,
    args: [workflowInput],
    workflowExecutionTimeout: '30 seconds',
    workflowRunTimeout: '20 seconds',
    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE_FAILED_ONLY,
  });

  const onAbort = () => {
    handle.cancel().catch((err) => logger.warn({ err, workflowId }, 'cancel failed'));
  };
  ctx.abortSignal.addEventListener('abort', onAbort);

  try {
    const result = await withTimeout(handle.result(), HTTP_GUARD_MS, 'HTTP_GUARD');
    return { kind: 'done', workflowId, result };
  } catch (err) {
    if (isTimeoutSentinel(err, 'HTTP_GUARD')) {
      return { kind: 'pending', workflowId };
    }
    throw err;
  } finally {
    ctx.abortSignal.removeEventListener('abort', onAbort);
  }
}

export async function getSearchStatus(
  searchId: string,
): Promise<{ status: string; result: WorkflowSearchResult | undefined }> {
  const client = await getTemporalClient();
  const handle = client.getHandle(searchId);
  const status = await handle.query(getStatusQuery);

  if (status === 'RUNNING') {
    return { status, result: undefined };
  }

  // The workflow has stopped running; handle.result() resolves immediately
  // against its already-recorded outcome, so this never actually waits.
  try {
    const result = await withTimeout(handle.result(), 2_000, 'POLL_RESULT_GUARD');
    return { status, result };
  } catch {
    return { status, result: undefined };
  }
}

export async function cancelSearch(searchId: string): Promise<void> {
  const client = await getTemporalClient();
  const handle = client.getHandle(searchId);
  await handle.cancel();
}
