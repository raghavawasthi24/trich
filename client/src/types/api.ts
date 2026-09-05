// MIRRORS: server/src/schemas/search.schema.ts + server/src/types/api.types.ts
// If the server contract changes, update this file and re-run the contract test
// (tests/e2e/contract.spec.ts).

export type Currency = 'INR' | 'USD' | 'EUR';
export type Supplier = 'A' | 'B';

export interface SearchRequest {
  city: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  adults: number;
  currency: Currency;
}

export interface Offer {
  hotelId: string;
  name: string;
  priceMinor: number;
  priceFormatted: string;
  currency: Currency;
  supplier: Supplier;
}

export type SupplierStatus = 'ok' | 'empty' | 'timeout' | 'error';

export interface SupplierReportRow {
  supplier: Supplier;
  status: SupplierStatus;
  offerCount?: number;
  latencyMs?: number;
  error?: string;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'NO_HOTELS_FOUND'
  | 'ALL_SUPPLIERS_FAILED'
  | 'SEARCH_TIMEOUT'
  | 'SEARCH_CANCELLED'
  | 'SEARCH_PENDING'
  | 'ORCHESTRATOR_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface SearchSuccessResponse {
  ok: true;
  searchId: string;
  best: Offer;
  consideredCount: number;
  suppliers: SupplierReportRow[];
  durationMs: number;
  requestId: string;
}

export interface SearchErrorResponse {
  ok: false;
  code: ErrorCode;
  message?: string;
  details?: unknown;
  searchId?: string;
  pollUrl?: string;
  retryAfterMs?: number;
  requestId: string;
}

export type SearchResponse = SearchSuccessResponse | SearchErrorResponse;
