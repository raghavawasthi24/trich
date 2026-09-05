import { Request, Response } from 'express';
import { asyncHandler } from '../helpers/asyncHandler';
import { parseScenario } from '../helpers/scenario';
import { applyScenario, resetAttemptCounters, resolveToken } from '../services/mockSupplier.service';

function respond(req: Request, res: Response, supplier: 'A' | 'B'): void {
  const city = String(req.query.city ?? '');
  const header = req.header('x-mock-scenario');
  const scenarioMap = parseScenario(header, city);
  const attemptKey = `${supplier}:${req.header('x-request-id') ?? req.ip}`;
  const token = resolveToken(scenarioMap, supplier, `${city}|${attemptKey}`);
  const outcome = applyScenario(token, city, supplier, attemptKey);

  const timer = setTimeout(() => {
    if (res.writableEnded) return;
    if (outcome.headers) res.set(outcome.headers);
    if (outcome.kind === 'malformed_text') {
      res.status(outcome.httpStatus).type('application/json').send(outcome.text);
      return;
    }
    if (outcome.kind === 'hang') {
      // Represents an upstream that never responds within a reasonable window;
      // the axios client-side timeout fires well before this.
      return;
    }
    res.status(outcome.httpStatus).json(outcome.body);
  }, outcome.delayMs);

  req.on('close', () => clearTimeout(timer));
}

export const supplierA = asyncHandler(async (req, res) => {
  respond(req, res, 'A');
});

export const supplierB = asyncHandler(async (req, res) => {
  respond(req, res, 'B');
});

export const reset = asyncHandler(async (_req, res) => {
  resetAttemptCounters();
  res.status(200).json({ ok: true });
});
