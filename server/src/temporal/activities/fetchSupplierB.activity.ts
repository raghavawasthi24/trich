import { env } from '../../config/env';
import { SearchWorkflowInput } from '../../types/api.types';
import { SupplierActivitySuccess } from '../../domain/normalizeOffers';
import { fetchSupplier } from './fetchSupplier';

export async function fetchSupplierB(input: SearchWorkflowInput): Promise<SupplierActivitySuccess> {
  return fetchSupplier('B', env.SUPPLIER_B_URL, input);
}
