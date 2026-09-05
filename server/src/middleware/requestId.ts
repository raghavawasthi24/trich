import { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { withRequestId } from '../helpers/logger';

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.trim().length > 0 ? incoming : uuidv4();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  withRequestId(id, next);
};
