import { Request } from 'express';

export function signalFromRequest(req: Request): AbortSignal {
  const controller = new AbortController();
  req.on('close', () => {
    if (!res_finished(req)) controller.abort();
  });
  return controller.signal;
}

function res_finished(req: Request): boolean {
  return req.res?.writableEnded ?? false;
}
