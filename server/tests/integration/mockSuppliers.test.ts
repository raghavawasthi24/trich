import request from 'supertest';
import { createApp } from '../../src/app';
import { resetAttemptCounters } from '../../src/services/mockSupplier.service';

const app = createApp();

describe('mock supplier endpoints', () => {
  beforeEach(() => {
    resetAttemptCounters();
  });

  it('returns a deterministic catalogue for a forced OK scenario', async () => {
    const res = await request(app).get('/supplierA/hotels').query({ city: 'goa' }).set('x-mock-scenario', 'A_OK');
    expect(res.status).toBe(200);
    expect(res.body.supplier).toBe('A');
    expect(Array.isArray(res.body.hotels)).toBe(true);
    expect(res.body.hotels.length).toBeGreaterThan(0);
  });

  it('is deterministic: same city + supplier produces the same catalogue every call', async () => {
    const first = await request(app).get('/supplierA/hotels').query({ city: 'mumbai' }).set('x-mock-scenario', 'A_OK');
    const second = await request(app).get('/supplierA/hotels').query({ city: 'mumbai' }).set('x-mock-scenario', 'A_OK');
    expect(first.body.hotels).toEqual(second.body.hotels);
  });

  it('forces an empty catalogue for EMPTY', async () => {
    const res = await request(app).get('/supplierB/hotels').query({ city: 'goa' }).set('x-mock-scenario', 'B_EMPTY');
    expect(res.status).toBe(200);
    expect(res.body.hotels).toEqual([]);
  });

  it('forces a 500 for FAIL_500', async () => {
    const res = await request(app).get('/supplierA/hotels').query({ city: 'goa' }).set('x-mock-scenario', 'A_FAIL_500');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('SupplierServerError');
  });

  it('forces a 503 with Retry-After for FAIL_503', async () => {
    const res = await request(app).get('/supplierB/hotels').query({ city: 'goa' }).set('x-mock-scenario', 'B_FAIL_503');
    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBe('1');
  });

  it('forces a 400 for FAIL_400 and a 401 for FAIL_401', async () => {
    const badRequest = await request(app)
      .get('/supplierA/hotels')
      .query({ city: 'goa' })
      .set('x-mock-scenario', 'A_FAIL_400');
    expect(badRequest.status).toBe(400);

    const unauthorized = await request(app)
      .get('/supplierA/hotels')
      .query({ city: 'goa' })
      .set('x-mock-scenario', 'A_FAIL_401');
    expect(unauthorized.status).toBe(401);
  });

  it('returns malformed JSON text for MALFORMED_JSON', async () => {
    // superagent auto-parses application/json bodies, which would throw on
    // this deliberately broken payload; bypass that with a raw text parser.
    const res = await request(app)
      .get('/supplierA/hotels')
      .query({ city: 'goa' })
      .set('x-mock-scenario', 'A_MALFORMED_JSON')
      .buffer(true)
      .parse((response, callback) => {
        let data = '';
        response.on('data', (chunk) => (data += chunk));
        response.on('end', () => callback(null, data));
      });
    expect(res.status).toBe(200);
    expect(res.body).toBe('{ not json');
  });

  it('coerces a SINGLE_OBJECT hotels field for downstream handling', async () => {
    const res = await request(app)
      .get('/supplierA/hotels')
      .query({ city: 'goa' })
      .set('x-mock-scenario', 'A_SINGLE_OBJECT');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.hotels)).toBe(false);
    expect(typeof res.body.hotels).toBe('object');
  });

  it('returns exactly 10000 hotels for HUGE_PAYLOAD', async () => {
    const res = await request(app)
      .get('/supplierA/hotels')
      .query({ city: 'goa' })
      .set('x-mock-scenario', 'A_HUGE_PAYLOAD');
    expect(res.status).toBe(200);
    expect(res.body.hotels).toHaveLength(10000);
  });

  it('FLAKY_2 fails twice then succeeds on the same attempt key', async () => {
    const key = 'flaky-test-key';
    const first = await request(app)
      .get('/supplierA/hotels')
      .query({ city: 'goa' })
      .set('x-mock-scenario', 'A_FLAKY_2')
      .set('x-request-id', key);
    const second = await request(app)
      .get('/supplierA/hotels')
      .query({ city: 'goa' })
      .set('x-mock-scenario', 'A_FLAKY_2')
      .set('x-request-id', key);
    const third = await request(app)
      .get('/supplierA/hotels')
      .query({ city: 'goa' })
      .set('x-mock-scenario', 'A_FLAKY_2')
      .set('x-request-id', key);

    expect(first.status).toBe(500);
    expect(second.status).toBe(500);
    expect(third.status).toBe(200);
  });

  it('produces a single-hotel TIE catalogue priced at exactly 7500.00 for both suppliers', async () => {
    const a = await request(app).get('/supplierA/hotels').query({ city: 'goa' }).set('x-mock-scenario', 'A_TIE');
    const b = await request(app).get('/supplierB/hotels').query({ city: 'goa' }).set('x-mock-scenario', 'B_TIE');
    expect(a.body.hotels[0].price).toBe(7500);
    expect(b.body.hotels[0].price).toBe(7500);
  });

  it('resolves scenarios via the reserved tiecity keyword with no header', async () => {
    const res = await request(app).get('/supplierA/hotels').query({ city: 'tiecity' });
    expect(res.body.hotels[0].price).toBe(7500);
  });
});
