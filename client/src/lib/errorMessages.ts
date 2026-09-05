import type { ErrorCode } from '../types/api';

export const errorMessages: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Something in that search looks off. Double-check the fields and try again.',
  UNAUTHORIZED: 'Your session token is missing or invalid.',
  NOT_FOUND: "We couldn't find that search.",
  PAYLOAD_TOO_LARGE: 'That request was too large to process.',
  RATE_LIMITED: "You're searching a bit fast — please wait a moment and try again.",
  NO_HOTELS_FOUND: 'No hotels found for those dates.',
  ALL_SUPPLIERS_FAILED: 'Both suppliers are currently unavailable. Please try again.',
  SEARCH_TIMEOUT: 'That search took too long. Please try again.',
  SEARCH_CANCELLED: 'Search cancelled.',
  SEARCH_PENDING: 'Still searching…',
  ORCHESTRATOR_UNAVAILABLE: 'The search service is temporarily unavailable. Please try again shortly.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again.',
};

export function messageFor(code: ErrorCode, fallback?: string): string {
  return errorMessages[code] ?? fallback ?? 'Something went wrong.';
}
