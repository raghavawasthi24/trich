import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { corsOrigins } from './config/env';
import { logger } from './helpers/logger';
import { requestId } from './middleware/requestId';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import { router } from './routes';

export function createApp(): Express {
  const app = express();

  app.use(requestId);
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: false,
      allowedHeaders: ['content-type', 'authorization', 'x-request-id', 'x-mock-scenario'],
      exposedHeaders: ['x-request-id', 'retry-after'],
    }),
  );
  app.use(express.json({ limit: '32kb' }));

  app.use(router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
