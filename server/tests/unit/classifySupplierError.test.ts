import { classifySupplierError, SupplierAuthError, SupplierBadRequestError, SupplierServerError, SupplierTimeoutError } from '../../src/domain/supplierErrors';

describe('classifySupplierError', () => {
  it('classifies 400/404 as non-retryable bad request errors', () => {
    expect(classifySupplierError('A', { response: { status: 400 } })).toBeInstanceOf(SupplierBadRequestError);
    expect(classifySupplierError('A', { response: { status: 404 } })).toBeInstanceOf(SupplierBadRequestError);
    expect(classifySupplierError('A', { response: { status: 400 } }).retryable).toBe(false);
  });

  it('classifies 401/403 as non-retryable auth errors', () => {
    const err = classifySupplierError('A', { response: { status: 401 } });
    expect(err).toBeInstanceOf(SupplierAuthError);
    expect(err.retryable).toBe(false);
  });

  it('classifies 429/500/503 as retryable server errors', () => {
    for (const status of [429, 500, 503]) {
      const err = classifySupplierError('B', { response: { status } });
      expect(err).toBeInstanceOf(SupplierServerError);
      expect(err.retryable).toBe(true);
    }
  });

  it('classifies ECONNABORTED as a retryable timeout', () => {
    const err = classifySupplierError('A', { code: 'ECONNABORTED' });
    expect(err).toBeInstanceOf(SupplierTimeoutError);
    expect(err.retryable).toBe(true);
  });

  it('extracts retry-after header into retryAfterMs for 429', () => {
    const err = classifySupplierError('A', { response: { status: 429, headers: { 'retry-after': '2' } } });
    expect(err).toBeInstanceOf(SupplierServerError);
    expect((err as SupplierServerError).retryAfterMs).toBe(2000);
  });
});
