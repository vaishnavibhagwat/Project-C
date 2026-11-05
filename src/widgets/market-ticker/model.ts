import { getNseSession } from '@/utils/time';
import type { MarketTickerConfig, MarketTickerWidgetData, TickerQuote } from './types';

/** Seconds each item takes to cross, by speed. The loop's duration scales with the items. */
export const SECONDS_PER_ITEM = { slow: 4.5, normal: 3, fast: 2 } as const;

/** Settings switch for each symbol (unknown symbols are always shown). */
const SHOW_KEYS: Partial<Record<string, keyof MarketTickerConfig>> = {
  showNIFTY50: 'showNIFTY50',
  showSENSEX: 'showSENSEX',
  showSPX: 'showSPX',
  showFTSE: 'showFTSE',
  showUSDINR: 'showUSDINR',
  showEURUSD: 'showEURUSD',
  showGOLD: 'showGOLD',
  showCRUDE: 'showCRUDE',
};

/** The quotes switched on in the settings, in the response's order. */
export function selectQuotes(
  data: MarketTickerWidgetData,
  config: MarketTickerConfig,
): TickerQuote[] {
  return data.quotes.filter((q) => {
    const key = SHOW_KEYS[`show${q.symbol}`];
    return key === undefined || config[key] === true;
  });
}

export function crawlSeconds(items: number, speed: MarketTickerConfig['speed']): number {
  return Math.max(6, items * SECONDS_PER_ITEM[speed]);
}

export function formatPrice(q: TickerQuote): string {
  return q.price.toLocaleString('en-IN', {
    minimumFractionDigits: q.decimals,
    maximumFractionDigits: q.decimals,
  });
}

export type Direction = 'up' | 'down' | 'flat';

/** Moves within ±0.005% count as unchanged. */
export function directionOf(changePct: number): Direction {
  if (changePct > 0.005) return 'up';
  if (changePct < -0.005) return 'down';
  return 'flat';
}

export function formatChange(changePct: number): string {
  const d = directionOf(changePct);
  const body = `${Math.abs(changePct).toFixed(2)}%`;
  return d === 'up' ? `+${body}` : d === 'down' ? `−${body}` : body;
}

export function quoteLabel(q: TickerQuote): string {
  const d = directionOf(q.changePct);
  const move = d === 'flat' ? 'unchanged' : `${d} ${Math.abs(q.changePct).toFixed(2)}%`;
  return `${q.name} ${formatPrice(q)}, ${move}. ${q.note}.`;
}

export type MarketStatus = 'pre-open' | 'open' | 'closed';

/** NSE status from the IST clock: Pre-open 09:00–09:15, Open 09:15–15:30, else Closed. */
export function nseStatus(nowMs: number): { status: MarketStatus; label: string } {
  const s = getNseSession(nowMs);
  if (s.phase === 'pre-open') return { status: 'pre-open', label: 'Pre-open' };
  if (s.phase === 'open') return { status: 'open', label: 'Open' };
  return { status: 'closed', label: s.label === 'Closed' ? 'Closed' : s.label };
}

/** SVG polyline points for a sparkline of `values` in a w × h box. */
export function sparkPoints(values: readonly number[], w: number, h: number): string {
  if (values.length < 2) return '';
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - lo) / span) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function summarizeTicker(quotes: readonly TickerQuote[]): string {
  if (quotes.length === 0) return 'No instruments selected.';
  return quotes.map((q) => `${q.name} ${formatPrice(q)} ${formatChange(q.changePct)}`).join('; ');
}
