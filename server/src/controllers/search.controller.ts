import { Request, Response } from 'express';
import { asyncHandler } from '../helpers/asyncHandler';
import { signalFromRequest } from '../helpers/signalFromRequest';
import * as searchService from '../services/search.service';
import { SearchRequest } from '../schemas/search.schema';
import { ErrorHttpStatus } from '../constants/errorCodes';
import { formatMoney } from '../helpers/money';
import { WorkflowSearchResult } from '../types/api.types';

function sendSearchResult(
  res: Response,
  workflowId: string,
  result: WorkflowSearchResult,
  requestId: string,
  city: string,
  durationMs: number,
): void {
  if (result.ok) {
    res.status(200).json({
      ok: true,
      searchId: workflowId,
      best: { ...result.best, priceFormatted: formatMoney(result.best.priceMinor, result.best.currency) },
      consideredCount: result.consideredCount,
      suppliers: result.suppliers,
      durationMs,
      requestId,
    });
    return;
  }

  if (result.code === 'NO_HOTELS_FOUND') {
    res.status(200).json({
      ok: false,
      code: result.code,
      message: `No hotels found for ${city} on those dates.`,
      searchId: workflowId,
      suppliers: result.suppliers,
      requestId,
    });
    return;
  }

  res.status(ErrorHttpStatus.ALL_SUPPLIERS_FAILED).json({
    ok: false,
    code: result.code,
    message: 'Both suppliers are currently unavailable. Please try again.',
    details: result.suppliers,
    searchId: workflowId,
    requestId,
  });
}

export const searchHotels = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as SearchRequest;
  const startedAt = Date.now();

  const outcome = await searchService.search(input, {
    requestId: req.requestId,
    scenario: req.header('x-mock-scenario') ?? undefined,
    abortSignal: signalFromRequest(req),
  });

  if (outcome.kind === 'pending') {
    res.status(202).json({
      ok: false,
      code: 'SEARCH_PENDING',
      searchId: outcome.workflowId,
      pollUrl: `/api/search-hotels/${outcome.workflowId}`,
      retryAfterMs: 1500,
      requestId: req.requestId,
    });
    return;
  }

  sendSearchResult(res, outcome.workflowId, outcome.result, req.requestId, input.city, Date.now() - startedAt);
});

export const getSearch = asyncHandler(async (req: Request, res: Response) => {
  const { searchId } = req.params as { searchId: string };
  const { status, result } = await searchService.getSearchStatus(searchId);

  if (status === 'RUNNING' || !result) {
    res.status(200).json({
      ok: false,
      code: 'SEARCH_PENDING',
      searchId,
      pollUrl: `/api/search-hotels/${searchId}`,
      retryAfterMs: 1500,
      requestId: req.requestId,
    });
    return;
  }

  sendSearchResult(res, searchId, result, req.requestId, '', 0);
});

export const cancelSearchHandler = asyncHandler(async (req: Request, res: Response) => {
  const { searchId } = req.params as { searchId: string };
  await searchService.cancelSearch(searchId);
  res.status(200).json({ ok: true, searchId, requestId: req.requestId });
});
