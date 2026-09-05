import { SearchWorkflowInput } from '../../src/types/api.types';

export function buildSearchInput(overrides: Partial<SearchWorkflowInput> = {}): SearchWorkflowInput {
  return {
    city: 'Goa',
    checkInDate: '2099-10-01',
    checkOutDate: '2099-10-04',
    adults: 2,
    currency: 'INR',
    ...overrides,
  };
}
