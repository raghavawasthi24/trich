import { collectFailures, normalizeOffers, SupplierSettled, supplierReport } from '../../src/domain/normalizeOffers';
import { SupplierServerError, SupplierTimeoutError } from '../../src/domain/supplierErrors';

function fulfilled(supplier: 'A' | 'B', hotels: unknown[], latencyMs = 100): SupplierSettled {
  return { status: 'fulfilled', value: { supplier, hotels, latencyMs } };
}

function rejected(reason: unknown): SupplierSettled {
  return { status: 'rejected', reason };
}

describe('normalizeOffers', () => {
  it('drops negative, zero, NaN, and null-priced hotels', () => {
    const a = fulfilled('A', [
      { hotelId: 'A-1', name: 'Neg', price: -100, currency: 'INR' },
      { hotelId: 'A-2', name: 'Zero', price: 0, currency: 'INR' },
      { hotelId: 'A-3', name: 'NaN', price: 'abc', currency: 'INR' },
      { hotelId: null, name: null, price: 5000, currency: 'INR' },
      { hotelId: 'A-4', name: 'Good', price: 5000, currency: 'INR' },
    ]);
    const b = rejected(new SupplierTimeoutError('B'));
    const offers = normalizeOffers(a, b, 'INR');
    expect(offers).toHaveLength(1);
    expect(offers[0].hotelId).toBe('A-4');
  });

  it('drops offers priced in a different currency than requested', () => {
    const a = fulfilled('A', [{ hotelId: 'A-1', name: 'USD Hotel', price: 100, currency: 'USD' }]);
    const b = rejected(new SupplierTimeoutError('B'));
    expect(normalizeOffers(a, b, 'INR')).toHaveLength(0);
  });

  it('converts major units to minor units correctly', () => {
    const a = fulfilled('A', [{ hotelId: 'A-1', name: 'Hotel', price: 8450.5, currency: 'INR' }]);
    const b = rejected(new SupplierTimeoutError('B'));
    const offers = normalizeOffers(a, b, 'INR');
    expect(offers[0].priceMinor).toBe(845050);
  });

  it('returns an empty array when both suppliers are rejected', () => {
    const a = rejected(new SupplierServerError('A', 500));
    const b = rejected(new SupplierTimeoutError('B'));
    expect(normalizeOffers(a, b, 'INR')).toHaveLength(0);
  });

  it('uses the fulfilled supplier when the other is rejected', () => {
    const a = rejected(new SupplierServerError('A', 500));
    const b = fulfilled('B', [{ hotelId: 'B-1', name: 'Hotel', price: 5000, currency: 'INR' }]);
    const offers = normalizeOffers(a, b, 'INR');
    expect(offers).toHaveLength(1);
    expect(offers[0].supplier).toBe('B');
  });
});

describe('collectFailures', () => {
  it('reports timeout vs error status per rejected supplier', () => {
    const a = rejected(new SupplierTimeoutError('A'));
    const b = rejected(new SupplierServerError('B', 500));
    const failures = collectFailures(a, b);
    expect(failures).toEqual([
      { supplier: 'A', status: 'timeout', error: expect.any(String) },
      { supplier: 'B', status: 'error', error: expect.any(String) },
    ]);
  });

  it('returns no rows when nothing was rejected', () => {
    const a = fulfilled('A', []);
    const b = fulfilled('B', []);
    expect(collectFailures(a, b)).toHaveLength(0);
  });
});

describe('supplierReport', () => {
  it('marks an offer-bearing supplier as ok and an empty one as empty', () => {
    const a = fulfilled('A', [{ hotelId: 'A-1', name: 'H', price: 100, currency: 'INR' }]);
    const b = fulfilled('B', []);
    const report = supplierReport(a, b);
    expect(report.find((r) => r.supplier === 'A')?.status).toBe('ok');
    expect(report.find((r) => r.supplier === 'B')?.status).toBe('empty');
  });
});
