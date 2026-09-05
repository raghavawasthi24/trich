import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { env } from '../config/env';
import { ApiError } from '../helpers/ApiError';

export const searchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: env.RATE_LIMIT_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `${req.ip}:${req.header('authorization') ?? ''}`,
  handler: (req, _res, next) => {
    next(new ApiError('RATE_LIMITED', 'Too many requests, please slow down'));
  },
});
