import { Request, Response } from 'express';
import { asyncHandler } from '../helpers/asyncHandler';
import { isTemporalHealthy } from '../services/temporalClient.service';

const startedAt = Date.now();
const VERSION = process.env.npm_package_version ?? '1.0.0';

export const health = asyncHandler(async (_req: Request, res: Response) => {
  const temporalUp = await isTemporalHealthy();
  res.status(200).json({
    status: temporalUp ? 'ok' : 'degraded',
    temporal: temporalUp ? 'up' : 'down',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    version: VERSION,
  });
});
