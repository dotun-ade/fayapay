/**
 * Money is always (BigInt minor units, ISO 4217 currency code).
 * Never use number for money. Never use Decimal in this codebase.
 * Format/parse happens at the boundary only.
 */

export type Currency =
  | 'NGN'
  | 'KES'
  | 'GHS'
  | 'ZAR'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'XOF'
  | 'XAF';

export interface Money {
  amount: bigint;
  currency: Currency;
}

const ZERO_DECIMAL: ReadonlySet<Currency> = new Set(['XOF', 'XAF']);
const THREE_DECIMAL: ReadonlySet<string> = new Set(['BHD', 'KWD', 'OMR', 'TND']);

export function minorUnits(currency: Currency): number {
  if (ZERO_DECIMAL.has(currency)) return 0;
  if (THREE_DECIMAL.has(currency)) return 3;
  return 2;
}

export function money(amount: bigint | number | string, currency: Currency): Money {
  return { amount: BigInt(amount), currency };
}

export function add(a: Money, b: Money): Money {
  assertSame(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function sub(a: Money, b: Money): Money {
  assertSame(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function isZero(m: Money): boolean {
  return m.amount === 0n;
}

export function isNegative(m: Money): boolean {
  return m.amount < 0n;
}

function assertSame(a: Money, b: Money) {
  if (a.currency !== b.currency) {
    throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

/**
 * Format for display. NOT for serialisation — APIs always send minor units.
 */
export function formatMoney(m: Money, locale = 'en-US'): string {
  const decimals = minorUnits(m.currency);
  const divisor = 10n ** BigInt(decimals);
  const whole = m.amount / divisor;
  const frac = (m.amount < 0n ? -m.amount : m.amount) % divisor;
  const fracStr = decimals === 0 ? '' : '.' + frac.toString().padStart(decimals, '0');
  const sign = m.amount < 0n ? '-' : '';
  const wholeAbs = whole < 0n ? -whole : whole;
  return new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency }).format(
    Number(`${sign}${wholeAbs}${fracStr}`),
  );
}

/**
 * Convert a major-units decimal string ("12.34") to BigInt minor units.
 * Throws on too many fractional digits — never silently truncate money.
 */
export function parseMajor(input: string, currency: Currency): bigint {
  const decimals = minorUnits(currency);
  const [whole, frac = ''] = input.replace(/[, ]/g, '').split('.');
  if (frac.length > decimals) {
    throw new Error(`too many decimal places for ${currency}: ${input}`);
  }
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const sign = whole?.startsWith('-') ? -1n : 1n;
  const wholeAbs = whole?.replace(/^-/, '') ?? '0';
  return sign * BigInt(wholeAbs + padded);
}
