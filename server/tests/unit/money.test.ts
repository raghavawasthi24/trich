import { formatMoney, toMajor, toMinor } from '../../src/helpers/money';

describe('money', () => {
  it('rounds toMinor for fractional paise', () => {
    expect(toMinor(8450.005)).toBe(845001);
    expect(toMinor(100)).toBe(10000);
  });

  it('round-trips toMajor', () => {
    expect(toMajor(10000)).toBe(100);
  });

  it('formats money per currency and locale', () => {
    expect(formatMoney(845000, 'INR')).toContain('8,450');
    expect(formatMoney(100000, 'USD', 'en-US')).toContain('1,000');
  });
});
