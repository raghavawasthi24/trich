import { timingSafeEqual } from 'node:crypto';
import { RequestHandler } from 'express';
import { env } from '../config/env';
import { ApiError } from '../helpers/ApiError';

function verifyToken(token: string): { id: string; role: string } | null {
  const expected = Buffer.from(env.API_TOKEN);
  const actual = Buffer.from(token);
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;
  return { id: 'static-token-user', role: 'user' };
}

export const auth: RequestHandler = (req, _res, next) => {
  if (env.AUTH_DISABLED) {
    req.user = { id: 'dev', role: 'user' };
    return next();
  }

  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError('UNAUTHORIZED', 'Missing bearer token');
  }

  const user = verifyToken(token);
  if (!user) throw new ApiError('UNAUTHORIZED', 'Invalid or expired token');

  req.user = user;
  next();
};
