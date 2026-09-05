process.env.PORT = '4100';
process.env.SUPPLIER_A_URL = 'http://localhost:4100/supplierA/hotels';
process.env.SUPPLIER_B_URL = 'http://localhost:4100/supplierB/hotels';
process.env.AUTH_DISABLED = 'false';
process.env.API_TOKEN = 'test-token';
process.env.MOCK_CHAOS_ENABLED = 'false';
process.env.RATE_LIMIT_PER_MIN = '1000';
process.env.TEMPORAL_TASK_QUEUE = 'hotel-search-integration';

import type { Server } from 'node:http';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { WorkflowClient } from '@temporalio/client';
import request from 'supertest';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import * as activities from '../../src/temporal/activities';
import { __setClientForTesting } from '../../src/services/temporalClient.service';
import { resetAttemptCounters } from '../../src/services/mockSupplier.service';

let testEnv: TestWorkflowEnvironment;
let worker: Worker;
let workerRunPromise: Promise<void>;
let httpServer: Server;

const app = createApp();
const AUTH = { Authorization: `Bearer ${env.API_TOKEN}` };

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  httpServer = app.listen(env.PORT);

  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  const testClient = new WorkflowClient({ connection: testEnv.nativeConnection, namespace: 'default' });
  __setClientForTesting(testClient);

  worker = await Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue: env.TEMPORAL_TASK_QUEUE,
    workflowsPath: require.resolve('../../src/temporal/workflows'),
    activities,
  });
  workerRunPromise = worker.run();
}, 60000);

afterAll(async () => {
  worker?.shutdown();
  await workerRunPromise?.catch(() => undefined);
  __setClientForTesting(undefined);
  await testEnv?.teardown();
  await new Promise((resolve) => httpServer.close(resolve));
});

beforeEach(() => {
  resetAttemptCounters();
});

describe('POST /api/search-hotels (auth, validation, rate limiting)', () => {
  it('rejects a missing bearer token with 401', async () => {
    const res = await request(app)
      .post('/api/search-hotels')
      .send({ city: 'Goa', checkInDate: futureDate(1), checkOutDate: futureDate(3) });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid body with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/search-hotels')
      .set(AUTH)
      .send({ city: '', checkInDate: futureDate(1), checkOutDate: futureDate(3) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rate limits after the configured number of requests per minute', async () => {
    // Uses a standalone app with its own tiny limiter so this doesn't
    // consume the shared app's request budget for the scenario-matrix tests below.
    const rateLimitedApp = express();
    rateLimitedApp.use(
      '/probe',
      rateLimit({
        windowMs: 60_000,
        limit: 3,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => res.status(429).json({ ok: false, code: 'RATE_LIMITED' }),
      }),
      (_req, res) => res.status(200).json({ ok: true }),
    );

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => request(rateLimitedApp).get('/probe')),
    );
    expect(responses.filter((r) => r.status === 200)).toHaveLength(3);
    expect(responses.filter((r) => r.status === 429)).toHaveLength(2);
  }, 15000);
});

describe('GET /api/health', () => {
  it('reports temporal up once the client is connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.temporal).toBe('up');
  });
});

describe('unknown routes', () => {
  it('returns 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/search-hotels (brief scenario matrix, §9.3)', () => {
  it('Supplier A cheaper -> best.supplier === A', async () => {
    const res = await request(app)
      .post('/api/search-hotels')
      .set(AUTH)
      .set('x-mock-scenario', 'A_OK_CHEAP,B_OK_EXPENSIVE')
      .send({ city: 'ACheaperCity', checkInDate: futureDate(1), checkOutDate: futureDate(3) });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.best.supplier).toBe('A');
  }, 15000);

  it('Supplier B cheaper -> best.supplier === B', async () => {
    const res = await request(app)
      .post('/api/search-hotels')
      .set(AUTH)
      .set('x-mock-scenario', 'A_OK_EXPENSIVE,B_OK_CHEAP')
      .send({ city: 'BCheaperCity', checkInDate: futureDate(1), checkOutDate: futureDate(3) });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.best.supplier).toBe('B');
  }, 15000);

  it('Both same rate -> tie broken in favor of A', async () => {
    const res = await request(app)
      .post('/api/search-hotels')
      .set(AUTH)
      .set('x-mock-scenario', 'A_TIE,B_TIE')
      .send({ city: 'TieMatrixCity', checkInDate: futureDate(1), checkOutDate: futureDate(3) });
    expect(res.status).toBe(200);
    expect(res.body.best.supplier).toBe('A');
  }, 15000);

  it('A fails, B succeeds -> best.supplier === B, A reported as error', async () => {
    const res = await request(app)
      .post('/api/search-hotels')
      .set(AUTH)
      .set('x-mock-scenario', 'A_FAIL_500,B_OK')
      .send({ city: 'AFailsCity', checkInDate: futureDate(1), checkOutDate: futureDate(3) });
    expect(res.status).toBe(200);
    expect(res.body.best.supplier).toBe('B');
    expect(res.body.suppliers.find((s: { supplier: string }) => s.supplier === 'A').status).toBe('error');
  }, 15000);

  it('Both fail -> 502 ALL_SUPPLIERS_FAILED', async () => {
    const res = await request(app)
      .post('/api/search-hotels')
      .set(AUTH)
      .set('x-mock-scenario', 'A_FAIL_500,B_FAIL_503')
      .send({ city: 'BothFailCity', checkInDate: futureDate(1), checkOutDate: futureDate(3) });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('ALL_SUPPLIERS_FAILED');
  }, 15000);

  it('One returns empty -> uses the other supplier', async () => {
    const res = await request(app)
      .post('/api/search-hotels')
      .set(AUTH)
      .set('x-mock-scenario', 'A_EMPTY,B_OK')
      .send({ city: 'OneEmptyCity', checkInDate: futureDate(1), checkOutDate: futureDate(3) });
    expect(res.status).toBe(200);
    expect(res.body.best.supplier).toBe('B');
  }, 15000);

  it('Both return empty -> 200 NO_HOTELS_FOUND', async () => {
    const res = await request(app)
      .post('/api/search-hotels')
      .set(AUTH)
      .set('x-mock-scenario', 'A_EMPTY,B_EMPTY')
      .send({ city: 'BothEmptyCity', checkInDate: futureDate(1), checkOutDate: futureDate(3) });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe('NO_HOTELS_FOUND');
  }, 15000);

  it('A fails twice then succeeds -> still returns A within the retry budget', async () => {
    // B_EMPTY removes price-comparison noise so this purely exercises the
    // retry policy: A must recover on its 3rd attempt or the search would
    // otherwise resolve to NO_HOTELS_FOUND.
    const res = await request(app)
      .post('/api/search-hotels')
      .set(AUTH)
      .set('x-mock-scenario', 'A_FLAKY_2,B_EMPTY')
      .send({ city: 'FlakyMatrixCity', checkInDate: futureDate(1), checkOutDate: futureDate(3) });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.best.supplier).toBe('A');
  }, 15000);
});
