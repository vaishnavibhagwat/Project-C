/** Number formatting. All money is INR by default (en-IN grouping), with USD where relevant. */

const cache = new Map<string, Intl.NumberFormat>();

function nf(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    cache.set(key, formatter);
  }
  return formatter;
}

export const MINUS = '−';

function signPrefix(value: number, signed: boolean): string {
  if (!signed) return value < 0 ? MINUS : '';
  if (value > 0) return '+';
  if (value < 0) return MINUS;
  return '';
}

export function formatNumber(value: number, fractionDigits = 0): string {
  const body = nf('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(value));
  return `${value < 0 ? MINUS : ''}${body}`;
}

/** Full INR amount: ₹1,23,456.78 */
export function formatInr(value: number, fractionDigits = 2, signed = false): string {
  const body = nf('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(value));
  return `${signPrefix(value, signed)}₹${body}`;
}

/** Compact INR using Indian units: ₹3,75,750 Cr, ₹12.4 L. */
export function formatInrCompact(value: number, signed = false): string {
  const abs = Math.abs(value);
  const prefix = signPrefix(value, signed);
  if (abs >= 1e7) {
    const crore = abs / 1e7;
    const digits = crore >= 1000 ? 0 : crore >= 100 ? 1 : 2;
    return `${prefix}₹${nf('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(crore)} Cr`;
  }
  if (abs >= 1e5) {
    return `${prefix}₹${nf('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs / 1e5)} L`;
  }
  return `${prefix}₹${nf('en-IN', { maximumFractionDigits: 0 }).format(abs)}`;
}

/** Compact USD: $45.0B, $312.4M. */
export function formatUsdCompact(value: number, signed = false): string {
  const abs = Math.abs(value);
  const prefix = signPrefix(value, signed);
  const units: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${prefix}$${(abs / size).toFixed(1)}${suffix}`;
  }
  return `${prefix}$${abs.toFixed(0)}`;
}

/** Percent from a fraction: 0.0123 -> "+1.23%". */
export function formatPct(fraction: number, fractionDigits = 2, signed = true): string {
  const body = (Math.abs(fraction) * 100).toFixed(fractionDigits);
  return `${signPrefix(fraction, signed)}${body}%`;
}

/** Percent from a value already in percent units: 12.3 -> "12.30%". */
export function formatPctPoints(value: number, fractionDigits = 2, signed = false): string {
  return formatPct(value / 100, fractionDigits, signed);
}

export function formatRatio(value: number, fractionDigits = 2): string {
  return `${value < 0 ? MINUS : ''}${Math.abs(value).toFixed(fractionDigits)}`;
}

export type Direction = 'up' | 'down' | 'flat';

export function direction(value: number, epsilon = 1e-9): Direction {
  if (value > epsilon) return 'up';
  if (value < -epsilon) return 'down';
  return 'flat';
}

/** Arrow glyph so direction is never conveyed by colour alone. */
export function directionArrow(value: number): string {
  const d = direction(value);
  if (d === 'up') return '▲';
  if (d === 'down') return '▼';
  return '■';
}

/** Words used in screen-reader summaries. */
export function directionWord(value: number): string {
  const d = direction(value);
  if (d === 'up') return 'up';
  if (d === 'down') return 'down';
  return 'unchanged';
}

export type MoneyCurrency = 'INR' | 'USD';

/** Compact money in the chosen display currency, converting INR with the configured FX rate. */
export function formatMoneyCompact(
  inr: number,
  currency: MoneyCurrency,
  fxUsdInr: number,
  signed = false,
): string {
  return currency === 'USD'
    ? formatUsdCompact(inr / fxUsdInr, signed)
    : formatInrCompact(inr, signed);
}
