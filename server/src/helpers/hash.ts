import { createHash } from 'node:crypto';

export function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

export function canonicalKey(input: {
  city: string;
  checkInDate: string;
  checkOutDate: string;
  currency: string;
  adults: number;
}): string {
  return [
    input.city.trim().toLowerCase(),
    input.checkInDate,
    input.checkOutDate,
    input.currency,
    input.adults,
  ].join('|');
}
