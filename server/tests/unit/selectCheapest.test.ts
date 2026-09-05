import { selectCheapest } from '../../src/domain/selectCheapest';
import { Offer } from '../../src/schemas/search.schema';

function offer(overrides: Partial<Offer>): Offer {
  return {
    hotelId: 'A-1000',
    name: 'Test Hotel',
    priceMinor: 500000,
    currency: 'INR',
    supplier: 'A',
    ...overrides,
  };
}

describe('selectCheapest', () => {
  it('picks the cheaper of two distinct offers (A cheaper)', () => {
    const a = offer({ hotelId: 'A-1', priceMinor: 100000, supplier: 'A' });
    const b = offer({ hotelId: 'B-1', priceMinor: 200000, supplier: 'B' });
    expect(selectCheapest([a, b])).toBe(a);
  });

  it('picks the cheaper of two distinct offers (B cheaper)', () => {
    const a = offer({ hotelId: 'A-1', priceMinor: 200000, supplier: 'A' });
    const b = offer({ hotelId: 'B-1', priceMinor: 100000, supplier: 'B' });
    expect(selectCheapest([a, b])).toBe(b);
  });

  it('breaks an exact tie in favor of supplier A', () => {
    const a = offer({ hotelId: 'A-1', priceMinor: 750000, supplier: 'A' });
    const b = offer({ hotelId: 'B-1', priceMinor: 750000, supplier: 'B' });
    expect(selectCheapest([b, a])).toBe(a);
  });

  it('breaks a three-way tie by lowest hotelId when supplier also ties', () => {
    const a1 = offer({ hotelId: 'A-2', priceMinor: 500000, supplier: 'A' });
    const a2 = offer({ hotelId: 'A-1', priceMinor: 500000, supplier: 'A' });
    expect(selectCheapest([a1, a2])).toBe(a2);
  });

  it('returns the only offer in a single-element array', () => {
    const only = offer({});
    expect(selectCheapest([only])).toBe(only);
  });

  it('throws on an empty array', () => {
    expect(() => selectCheapest([])).toThrow();
  });
});
