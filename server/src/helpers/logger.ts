import pino from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '../config/env';

export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
      : undefined,
  mixin() {
    const ctx = requestContext.getStore();
    return ctx ? { requestId: ctx.requestId } : {};
  },
});

export function withRequestId<T>(requestId: string, fn: () => T): T {
  return requestContext.run({ requestId }, fn);
}
