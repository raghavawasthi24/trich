import { SearchRequestSchema } from '../../src/schemas/search.schema';

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

describe('SearchRequestSchema', () => {
  it('accepts a valid request and applies defaults', () => {
    const result = SearchRequestSchema.safeParse({
      city: 'Goa',
      checkInDate: futureDate(5),
      checkOutDate: futureDate(8),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.adults).toBe(2);
      expect(result.data.currency).toBe('INR');
    }
  });

  it('rejects empty or whitespace-only city', () => {
    expect(
      SearchRequestSchema.safeParse({ city: ' ', checkInDate: futureDate(1), checkOutDate: futureDate(2) }).success,
    ).toBe(false);
  });

  it('rejects checkOut before or equal to checkIn', () => {
    const result = SearchRequestSchema.safeParse({
      city: 'Goa',
      checkInDate: futureDate(5),
      checkOutDate: futureDate(5),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a checkIn date in the past', () => {
    const result = SearchRequestSchema.safeParse({
      city: 'Goa',
      checkInDate: futureDate(-2),
      checkOutDate: futureDate(1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a stay longer than 30 nights', () => {
    const result = SearchRequestSchema.safeParse({
      city: 'Goa',
      checkInDate: futureDate(1),
      checkOutDate: futureDate(35),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO date string', () => {
    const result = SearchRequestSchema.safeParse({
      city: 'Goa',
      checkInDate: '13/45/2026',
      checkOutDate: futureDate(2),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a city over 100 characters', () => {
    const result = SearchRequestSchema.safeParse({
      city: 'x'.repeat(101),
      checkInDate: futureDate(1),
      checkOutDate: futureDate(2),
    });
    expect(result.success).toBe(false);
  });

  it('strips unknown extra fields instead of erroring', () => {
    const result = SearchRequestSchema.safeParse({
      city: 'Goa',
      checkInDate: futureDate(1),
      checkOutDate: futureDate(2),
      extraField: 'nope',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).extraField).toBeUndefined();
    }
  });
});
