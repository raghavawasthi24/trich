export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function nights(checkInDate: string, checkOutDate: string): number {
  const inD = new Date(checkInDate);
  const outD = new Date(checkOutDate);
  const ms = outD.getTime() - inD.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function isValidRange(checkInDate: string, checkOutDate: string): boolean {
  return new Date(checkOutDate) > new Date(checkInDate);
}
