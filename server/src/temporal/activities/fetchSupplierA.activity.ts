import { env } from '../../config/env';
import { SearchWorkflowInput } from '../../types/api.types';
import { SupplierActivitySuccess } from '../../domain/normalizeOffers';
import { fetchSupplier } from './fetchSupplier';

export async function fetchSupplierA(input: SearchWorkflowInput): Promise<SupplierActivitySuccess> {
  return fetchSupplier('A', env.SUPPLIER_A_URL, input);
}
