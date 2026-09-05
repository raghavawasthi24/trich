import { RequestHandler } from 'express';
import { ApiError } from '../helpers/ApiError';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError('NOT_FOUND', `Route not found: ${req.method} ${req.path}`));
};
