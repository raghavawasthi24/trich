import { Router } from 'express';
import { auth } from '../middleware/auth';
import { healthRoutes } from './health.routes';
import { searchRoutes } from './search.routes';
import { mockRoutes } from './mock.routes';

export const router = Router();

router.use('/api/health', healthRoutes);
router.use('/api/search-hotels', auth, searchRoutes);
router.use('/', mockRoutes);
