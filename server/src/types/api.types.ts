import { ErrorCode } from '../constants/errorCodes';
import { Offer, SearchRequest } from '../schemas/search.schema';

export interface SearchWorkflowInput extends SearchRequest {
  scenario?: string;
  requestId?: string;
}

export type SupplierStatus = 'ok' | 'empty' | 'timeout' | 'error';

export interface SupplierReportRow {
  supplier: 'A' | 'B';
  status: SupplierStatus;
  offerCount?: number;
  latencyMs?: number;
  error?: string;
}

export interface SearchSuccessResult {
  ok: true;
  best: Offer;
  consideredCount: number;
  suppliers: SupplierReportRow[];
}

export interface SearchFailureResult {
  ok: false;
  code: 'NO_HOTELS_FOUND' | 'ALL_SUPPLIERS_FAILED';
  suppliers: SupplierReportRow[];
}

export type WorkflowSearchResult = SearchSuccessResult | SearchFailureResult;

export type WorkflowStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

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
