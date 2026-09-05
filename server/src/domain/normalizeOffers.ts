import { ActivityFailure, CancelledFailure, TimeoutFailure } from '@temporalio/workflow';
import { Offer } from '../schemas/search.schema';
import { SupplierHotelSchema } from '../schemas/supplier.schema';
import { toMinor } from '../helpers/money';
import { SupplierReportRow, SupplierStatus } from '../types/api.types';
import { SupplierTimeoutError } from './supplierErrors';

export interface SupplierActivitySuccess {
  supplier: 'A' | 'B';
  hotels: unknown[];
  latencyMs: number;
}

export type SupplierSettled = PromiseSettledResult<SupplierActivitySuccess>;

const SUPPLIER_PRIORITY: Record<'A' | 'B', number> = { A: 0, B: 1 };

/**
 * True for our own SupplierTimeoutError as well as for the shape a rejection
 * takes when the per-supplier 5s CancellationScope.withTimeout guard fires:
 * the activity call rejects with ActivityFailure(cause: CancelledFailure), or
 * occasionally a bare CancelledFailure/TimeoutFailure.
 */
function isTimeoutLike(reason: unknown): boolean {
  if (reason instanceof SupplierTimeoutError) return true;
  if (reason instanceof TimeoutFailure) return true;
  if (reason instanceof CancelledFailure) return true;
  if (reason instanceof ActivityFailure && reason.cause instanceof CancelledFailure) return true;
  return false;
}

function statusFor(settled: SupplierSettled, offerCount: number): SupplierStatus {
  if (settled.status === 'rejected') {
    return isTimeoutLike(settled.reason) ? 'timeout' : 'error';
  }
  return offerCount === 0 ? 'empty' : 'ok';
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  return String(reason);
}

/**
 * Unwraps the two settled supplier activity results, validates each raw hotel
 * against the supplier contract, converts prices to minor units, drops
 * malformed/non-positive/wrong-currency offers, and tags each offer's supplier.
 */
export function normalizeOffers(
  a: SupplierSettled,
  b: SupplierSettled,
  requestedCurrency: 'INR' | 'USD' | 'EUR',
): Offer[] {
  const offers: Offer[] = [];

  for (const settled of [a, b]) {
    if (settled.status !== 'fulfilled') continue;
    const { supplier, hotels } = settled.value;

    for (const raw of hotels) {
      const parsed = SupplierHotelSchema.safeParse(raw);
      if (!parsed.success) continue;
      const hotel = parsed.data;
      if (hotel.currency && hotel.currency !== requestedCurrency) continue;

      offers.push({
        hotelId: hotel.hotelId,
        name: hotel.name,
        priceMinor: toMinor(hotel.price),
        currency: requestedCurrency,
        supplier,
      });
    }
  }

  return offers;
}

export function collectFailures(a: SupplierSettled, b: SupplierSettled): SupplierReportRow[] {
  const rows: SupplierReportRow[] = [];
  for (const [supplier, settled] of [['A', a], ['B', b]] as const) {
    if (settled.status !== 'rejected') continue;
    rows.push({
      supplier,
      status: isTimeoutLike(settled.reason) ? 'timeout' : 'error',
      error: errorMessage(settled.reason),
    });
  }
  return rows;
}

export function supplierReport(a: SupplierSettled, b: SupplierSettled): SupplierReportRow[] {
  return (['A', 'B'] as const).map((supplierId) => {
    const settled = supplierId === 'A' ? a : b;
    if (settled.status === 'fulfilled') {
      return {
        supplier: supplierId,
        status: statusFor(settled, settled.value.hotels.length),
        offerCount: settled.value.hotels.length,
        latencyMs: settled.value.latencyMs,
      };
    }
    return {
      supplier: supplierId,
      status: statusFor(settled, 0),
      offerCount: 0,
      error: errorMessage(settled.reason),
    };
  });
}

export { SUPPLIER_PRIORITY };
