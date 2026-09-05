import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { ApiError } from '../helpers/ApiError';
import { logger } from '../helpers/logger';
import { ErrorCode, ErrorHttpStatus } from '../constants/errorCodes';

function unwrapCause(err: unknown): unknown {
  return err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : undefined;
}

function nameOf(err: unknown): string | undefined {
  return err && typeof err === 'object' && 'name' in err ? (err as { name?: string }).name : undefined;
}

/**
 * Temporal client errors are matched by constructor/cause .name rather than
 * instanceof, since the SDK's failure classes are duck-typed across the
 * handle.result() rejection chain (WorkflowFailedError -> cause).
 */
function mapWorkflowFailure(err: unknown): { code: ErrorCode; message: string } | null {
  const topName = nameOf(err);
  if (topName === 'WorkflowNotFoundError') {
    return { code: 'NOT_FOUND', message: 'Search not found' };
  }
  if (topName !== 'WorkflowFailedError' && topName !== 'WorkflowFailureError') {
    return null;
  }
  const cause = unwrapCause(err);
  const causeName = nameOf(cause);
  if (causeName === 'CancelledFailure') {
    return { code: 'SEARCH_CANCELLED', message: 'Search was cancelled' };
  }
  if (causeName === 'TimeoutFailure') {
    return { code: 'SEARCH_TIMEOUT', message: 'Search timed out' };
  }
  if (causeName === 'ApplicationFailure') {
    const applicationType = (cause as { type?: string } | undefined)?.type;
    if (applicationType === 'NoHotelsFound') {
      return { code: 'NO_HOTELS_FOUND', message: 'No hotels found for those dates' };
    }
    if (applicationType === 'AllSuppliersFailed') {
      return { code: 'ALL_SUPPLIERS_FAILED', message: 'Both suppliers are currently unavailable' };
    }
  }
  return { code: 'INTERNAL_ERROR', message: 'Search failed unexpectedly' };
}

const CONNECTION_ERROR_MESSAGE = /failed to connect before the deadline|econnrefused|unavailable/i;

function isConnectionRefused(err: unknown): boolean {
  const name = nameOf(err);
  const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: unknown }).code : undefined;
  if (name === 'ServiceError' || name === 'TransportError' || code === 'ECONNREFUSED' || code === 14) return true;
  // grpc-js's connect-timeout throws a plain Error with no distinguishing
  // name/code, just this message — match on it as a fallback.
  const message = err instanceof Error ? err.message : undefined;
  return !!message && CONNECTION_ERROR_MESSAGE.test(message);
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    logger.warn({ err, requestId: req.requestId }, 'ApiError');
    res.status(err.status).json({
      ok: false,
      code: err.code,
      message: err.message,
      details: err.details,
      searchId: err.searchId,
      requestId: req.requestId,
    });
    return;
  }

  const bodyParserErr = err as { type?: string; status?: number };
  if (bodyParserErr.type === 'entity.too.large' || bodyParserErr.status === 413) {
    res.status(413).json({
      ok: false,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body exceeds the 32kb limit',
      requestId: req.requestId,
    });
    return;
  }

  if (bodyParserErr.type === 'entity.parse.failed') {
    res.status(400).json({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Request body is not valid JSON',
      requestId: req.requestId,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.flatten(),
      requestId: req.requestId,
    });
    return;
  }

  const workflowFailure = mapWorkflowFailure(err);
  if (workflowFailure) {
    logger.warn({ err, requestId: req.requestId }, 'Workflow failure');
    res.status(ErrorHttpStatus[workflowFailure.code]).json({
      ok: workflowFailure.code === 'NO_HOTELS_FOUND' ? false : false,
      code: workflowFailure.code,
      message: workflowFailure.message,
      requestId: req.requestId,
    });
    return;
  }

  if (isConnectionRefused(err)) {
    logger.error({ err, requestId: req.requestId }, 'Orchestrator unavailable');
    res.status(503).json({
      ok: false,
      code: 'ORCHESTRATOR_UNAVAILABLE',
      message: 'Search orchestrator is currently unavailable',
      requestId: req.requestId,
    });
    return;
  }

  logger.error({ err, requestId: req.requestId }, 'Unhandled error');
  res.status(500).json({
    ok: false,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    ...(env.NODE_ENV !== 'production' && err instanceof Error ? { details: err.stack } : {}),
    requestId: req.requestId,
  });
};
