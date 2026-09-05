import { Offer } from '../schemas/search.schema';
import { SUPPLIER_PRIORITY } from './normalizeOffers';

/**
 * Deterministic tie-break: price ASC -> supplier priority (A before B) -> hotelId ASC.
 */
export function selectCheapest(offers: Offer[]): Offer {
  if (offers.length === 0) {
    throw new Error('selectCheapest called with an empty offer list');
  }

  return [...offers].sort((x, y) => {
    if (x.priceMinor !== y.priceMinor) return x.priceMinor - y.priceMinor;
    const priorityDiff = SUPPLIER_PRIORITY[x.supplier] - SUPPLIER_PRIORITY[y.supplier];
    if (priorityDiff !== 0) return priorityDiff;
    return x.hotelId < y.hotelId ? -1 : x.hotelId > y.hotelId ? 1 : 0;
  })[0];
}
