import { ErrorCode, ErrorHttpStatus } from '../constants/errorCodes';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly searchId?: string;

  constructor(code: ErrorCode, message?: string, details?: unknown, searchId?: string) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.status = ErrorHttpStatus[code];
    this.details = details;
    this.searchId = searchId;
  }
}
