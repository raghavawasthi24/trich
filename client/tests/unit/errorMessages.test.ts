import { describe, expect, it } from 'vitest';
import { errorMessages } from '../../src/lib/errorMessages';
import type { ErrorCode } from '../../src/types/api';

const ALL_CODES: ErrorCode[] = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'NO_HOTELS_FOUND',
  'ALL_SUPPLIERS_FAILED',
  'SEARCH_TIMEOUT',
  'SEARCH_CANCELLED',
  'SEARCH_PENDING',
  'ORCHESTRATOR_UNAVAILABLE',
  'INTERNAL_ERROR',
];

describe('errorMessages', () => {
  it('maps every ErrorCode to non-empty user-facing text', () => {
    for (const code of ALL_CODES) {
      expect(errorMessages[code]).toBeTruthy();
      expect(errorMessages[code].length).toBeGreaterThan(0);
    }
  });
});
