export class SupplierError extends Error {
  readonly supplier: 'A' | 'B';
  readonly retryable: boolean;

  constructor(message: string, supplier: 'A' | 'B', retryable: boolean) {
    super(message);
    this.name = new.target.name;
    this.supplier = supplier;
    this.retryable = retryable;
  }
}

export class SupplierServerError extends SupplierError {
  readonly status: number;
  readonly retryAfterMs?: number;
  constructor(supplier: 'A' | 'B', status: number, message = `Supplier server error ${status}`, retryAfterMs?: number) {
    super(message, supplier, true);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export class SupplierTimeoutError extends SupplierError {
  constructor(supplier: 'A' | 'B', message = 'Supplier request timed out') {
    super(message, supplier, true);
  }
}

export class SupplierBadRequestError extends SupplierError {
  readonly status: number;
  constructor(supplier: 'A' | 'B', status: number, message = `Supplier bad request ${status}`) {
    super(message, supplier, false);
    this.status = status;
  }
}

export class SupplierAuthError extends SupplierError {
  readonly status: number;
  constructor(supplier: 'A' | 'B', status: number, message = `Supplier auth error ${status}`) {
    super(message, supplier, false);
    this.status = status;
  }
}

export class SupplierMalformedResponseError extends SupplierError {
  constructor(supplier: 'A' | 'B', message = 'Supplier returned malformed response') {
    super(message, supplier, false);
  }
}

/**
 * Maps an axios-style failure to a typed SupplierError.
 * 429/500/502/503 and network/timeout errors are retryable; 400/401/403/404 are not.
 */
export function classifySupplierError(
  supplier: 'A' | 'B',
  err: { code?: string; response?: { status: number; headers?: Record<string, string> } },
): SupplierError {
  if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED' || err.code === 'ETIMEDOUT') {
    return new SupplierTimeoutError(supplier);
  }
  const status = err.response?.status;
  if (status === undefined) {
    return new SupplierServerError(supplier, 0, 'Network error contacting supplier');
  }
  if (status === 401 || status === 403) {
    return new SupplierAuthError(supplier, status);
  }
  if (status === 400 || status === 404) {
    return new SupplierBadRequestError(supplier, status);
  }
  if (status === 429) {
    const retryAfterHeader = err.response?.headers?.['retry-after'];
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
    return new SupplierServerError(supplier, status, 'Supplier rate limited', retryAfterMs);
  }
  return new SupplierServerError(supplier, status);
}
