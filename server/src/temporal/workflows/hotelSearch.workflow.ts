import {
  proxyActivities,
  setHandler,
  defineQuery,
  CancellationScope,
  isCancellation,
  ApplicationFailure,
  log,
} from '@temporalio/workflow';
import type * as activities from '../activities';
import { SearchWorkflowInput, WorkflowSearchResult, WorkflowStatus } from '../../types/api.types';
import { collectFailures, normalizeOffers, supplierReport } from '../../domain/normalizeOffers';
import { selectCheapest } from '../../domain/selectCheapest';

export const getStatusQuery = defineQuery<WorkflowStatus>('getStatus');

const { fetchSupplierA, fetchSupplierB } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 seconds',
  scheduleToCloseTimeout: '15 seconds',
  heartbeatTimeout: '2 seconds',
  retry: {
    initialInterval: '200ms',
    backoffCoefficient: 2,
    maximumInterval: '2s',
    maximumAttempts: 3,
    nonRetryableErrorTypes: ['SupplierBadRequestError', 'SupplierAuthError'],
  },
});

function guarded<T>(fn: () => Promise<T>): Promise<T> {
  return CancellationScope.withTimeout(5_000, fn);
}

export async function hotelSearchWorkflow(input: SearchWorkflowInput): Promise<WorkflowSearchResult> {
  let status: WorkflowStatus = 'RUNNING';
  setHandler(getStatusQuery, () => status);

  // Promise.allSettled never rejects, so a workflow-level cancellation (as
  // opposed to the per-supplier 5s guard) would otherwise be swallowed as two
  // ordinary supplier failures. Race it against the root scope's own
  // cancellation so handle.cancel() still surfaces a CancelledFailure.
  const rootCancelRequested = CancellationScope.current().cancelRequested;

  try {
    const [a, b] = await Promise.race([
      Promise.allSettled([guarded(() => fetchSupplierA(input)), guarded(() => fetchSupplierB(input))]),
      rootCancelRequested,
    ]);

    const offers = normalizeOffers(a, b, input.currency);
    const failures = collectFailures(a, b);

    if (offers.length === 0) {
      status = 'COMPLETED';
      if (failures.length === 2) {
        return { ok: false, code: 'ALL_SUPPLIERS_FAILED', suppliers: supplierReport(a, b) };
      }
      return { ok: false, code: 'NO_HOTELS_FOUND', suppliers: supplierReport(a, b) };
    }

    status = 'COMPLETED';
    return {
      ok: true,
      best: selectCheapest(offers),
      consideredCount: offers.length,
      suppliers: supplierReport(a, b),
    };
  } catch (err) {
    if (isCancellation(err)) {
      status = 'CANCELLED';
      await CancellationScope.nonCancellable(async () => {
        log.info('hotelSearchWorkflow cancelled', { city: input.city });
      });
      throw err;
    }
    status = 'FAILED';
    throw ApplicationFailure.nonRetryable(
      err instanceof Error ? err.message : 'Unknown workflow failure',
      'HotelSearchWorkflowFailed',
    );
  }
}
