import { Router } from 'express';
import { validate } from '../middleware/validate';
import { SupplierQuerySchema } from '../schemas/supplier.schema';
import * as mockCtrl from '../controllers/mock.controller';

export const mockRoutes = Router();

mockRoutes.get('/supplierA/hotels', validate(SupplierQuerySchema, 'query'), mockCtrl.supplierA);
mockRoutes.get('/supplierB/hotels', validate(SupplierQuerySchema, 'query'), mockCtrl.supplierB);
mockRoutes.post('/mock/reset', mockCtrl.reset);
