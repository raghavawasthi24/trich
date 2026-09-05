import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { ApiError } from '../../src/helpers/ApiError';
import { errorHandler } from '../../src/middleware/errorHandler';

describe('errorHandler', () => {
  it('maps ApiError to its own status and code', async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).requestId = 'rid-1';
      next();
    });
    app.get('/boom', () => {
      throw new ApiError('UNAUTHORIZED', 'no token');
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ ok: false, code: 'UNAUTHORIZED', requestId: 'rid-1' });
  });

  it('maps ZodError to 400 VALIDATION_ERROR with details', async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).requestId = 'rid-2';
      next();
    });
    app.get('/boom', () => {
      const schema = z.object({ x: z.string() });
      const result = schema.safeParse({});
      if (!result.success) throw result.error;
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details).toBeDefined();
  });

  it('maps an unknown thrown error to 500 INTERNAL_ERROR', async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).requestId = 'rid-3';
      next();
    });
    app.get('/boom', () => {
      throw new Error('unexpected');
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });

  it('maps a Temporal-style connection-refused error to 503 ORCHESTRATOR_UNAVAILABLE', async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).requestId = 'rid-4';
      next();
    });
    app.get('/boom', () => {
      const err = new Error('connect ECONNREFUSED') as Error & { code: string };
      err.code = 'ECONNREFUSED';
      throw err;
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ORCHESTRATOR_UNAVAILABLE');
  });

  it('maps grpc-js\'s plain "Failed to connect before the deadline" error to 503 ORCHESTRATOR_UNAVAILABLE', async () => {
    // Regression test: Connection.connect() timing out throws a bare Error
    // with no distinguishing .name/.code, only this message text.
    const app = express();
    app.use((req, _res, next) => {
      (req as any).requestId = 'rid-5';
      next();
    });
    app.get('/boom', () => {
      throw new Error('Failed to connect before the deadline');
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ORCHESTRATOR_UNAVAILABLE');
  });
});
