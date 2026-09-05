import { Router } from 'express';
import { validate } from '../middleware/validate';
import { searchRateLimit } from '../middleware/rateLimit';
import { SearchIdParamSchema, SearchRequestSchema } from '../schemas/search.schema';
import * as ctrl from '../controllers/search.controller';

export const searchRoutes = Router();

searchRoutes.post('/', searchRateLimit, validate(SearchRequestSchema, 'body'), ctrl.searchHotels);
searchRoutes.get('/:searchId', validate(SearchIdParamSchema, 'params'), ctrl.getSearch);
searchRoutes.delete('/:searchId', validate(SearchIdParamSchema, 'params'), ctrl.cancelSearchHandler);
