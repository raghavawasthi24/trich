import type { Currency } from '../types/api';

export function formatMoney(priceMinor: number, currency: Currency, locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(priceMinor / 100);
}
