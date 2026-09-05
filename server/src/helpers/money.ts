export function toMinor(major: number): number {
  // Avoid binary float artifacts (e.g. 8450.005 * 100 === 845000.4999999999)
  // by rounding through a fixed-decimal string before the final Math.round.
  return Math.round(Number((major * 100).toFixed(4)));
}

export function toMajor(minor: number): number {
  return minor / 100;
}

export function formatMoney(minor: number, currency: string, locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(toMajor(minor));
}
