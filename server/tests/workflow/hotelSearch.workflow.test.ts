import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { WorkflowFailedError } from '@temporalio/client';
import { hotelSearchWorkflow } from '../../src/temporal/workflows';
import { SupplierActivitySuccess } from '../../src/domain/normalizeOffers';
import { SupplierServerError } from '../../src/domain/supplierErrors';
import { buildSearchInput } from '../helpers/buildSearchInput';

const TASK_QUEUE = 'test-hotel-search';

let testEnv: TestWorkflowEnvironment;

beforeAll(async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
}, 30000);

afterAll(async () => {
  await testEnv?.teardown();
});

function cheapHotel(supplier: 'A' | 'B', price = 5000): SupplierActivitySuccess {
  return {
    supplier,
    hotels: [{ hotelId: `${supplier}-1`, name: `${supplier} Hotel`, price, currency: 'INR' }],
    latencyMs: 10,
  };
}

async function runWorkflow(
  activityImpls: Record<string, (...args: any[]) => Promise<any>>,
  inputOverrides: Partial<Parameters<typeof buildSearchInput>[0]> = {},
) {
  const worker = await Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve('../../src/temporal/workflows'),
    activities: activityImpls,
  });

  return worker.runUntil(
    testEnv.client.workflow.execute(hotelSearchWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId: `wf-${Date.now()}-${Math.random()}`,
      args: [buildSearchInput(inputOverrides)],
    }),
  );
}

describe('hotelSearchWorkflow', () => {
  it('B1: returns supplier A when it is cheaper', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => cheapHotel('A', 3000),
      fetchSupplierB: async () => cheapHotel('B', 8000),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.best.supplier).toBe('A');
  });

  it('B2: returns supplier B when it is cheaper', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => cheapHotel('A', 8000),
      fetchSupplierB: async () => cheapHotel('B', 3000),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.best.supplier).toBe('B');
  });

  it('B3: breaks an exact tie in favor of supplier A', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => ({
        supplier: 'A',
        hotels: [{ hotelId: 'A-1000', name: 'Tie', price: 7500, currency: 'INR' }],
        latencyMs: 10,
      }),
      fetchSupplierB: async () => ({
        supplier: 'B',
        hotels: [{ hotelId: 'B-1000', name: 'Tie', price: 7500, currency: 'INR' }],
        latencyMs: 10,
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.best.supplier).toBe('A');
  });

  it('B4: A fails, B succeeds -> returns B', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => {
        throw new SupplierServerError('A', 500);
      },
      fetchSupplierB: async () => cheapHotel('B'),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.best.supplier).toBe('B');
  });

  it('B5: both suppliers fail -> ALL_SUPPLIERS_FAILED', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => {
        throw new SupplierServerError('A', 500);
      },
      fetchSupplierB: async () => {
        throw new SupplierServerError('B', 503);
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('ALL_SUPPLIERS_FAILED');
  });

  it('B6: one supplier returns empty -> uses the other', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => ({ supplier: 'A', hotels: [], latencyMs: 10 }),
      fetchSupplierB: async () => cheapHotel('B'),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.best.supplier).toBe('B');
  });

  it('B7: both suppliers return empty -> NO_HOTELS_FOUND', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => ({ supplier: 'A', hotels: [], latencyMs: 10 }),
      fetchSupplierB: async () => ({ supplier: 'B', hotels: [], latencyMs: 10 }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NO_HOTELS_FOUND');
  });

  it('A1: a supplier taking >5s is cancelled while the other proceeds (time-skipped)', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => {
        await new Promise((resolve) => setTimeout(resolve, 6000));
        return cheapHotel('A');
      },
      fetchSupplierB: async () => cheapHotel('B'),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.best.supplier).toBe('B');
  }, 20000);

  it('A2: A fails twice then succeeds within the retry budget', async () => {
    let attempts = 0;
    const result = await runWorkflow({
      fetchSupplierA: async () => {
        attempts += 1;
        if (attempts <= 2) throw new SupplierServerError('A', 500);
        return cheapHotel('A', 3000);
      },
      fetchSupplierB: async () => cheapHotel('B', 8000),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.best.supplier).toBe('A');
    expect(attempts).toBe(3);
  }, 20000);

  it('reports a timeout status for a supplier cancelled by the 5s guard', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => {
        await new Promise((resolve) => setTimeout(resolve, 6000));
        return cheapHotel('A');
      },
      fetchSupplierB: async () => cheapHotel('B'),
    });
    expect(result.suppliers.find((s) => s.supplier === 'A')?.status).toBe('timeout');
  }, 20000);

  it('A3: cancelling the workflow surfaces a CancelledFailure', async () => {
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath: require.resolve('../../src/temporal/workflows'),
      activities: {
        fetchSupplierA: async () => {
          await new Promise((resolve) => setTimeout(resolve, 6000));
          return cheapHotel('A');
        },
        fetchSupplierB: async () => {
          await new Promise((resolve) => setTimeout(resolve, 6000));
          return cheapHotel('B');
        },
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(hotelSearchWorkflow, {
        taskQueue: TASK_QUEUE,
        workflowId: `wf-cancel-${Date.now()}`,
        args: [buildSearchInput()],
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      await handle.cancel();
      await expect(handle.result()).rejects.toThrow(WorkflowFailedError);
    });
  }, 20000);
});
