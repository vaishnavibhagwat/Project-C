import type { Holding } from '@/types';

/** Unrealised profit or loss against average cost, INR (from the portfolio model). */
export function unrealisedPnL(h: Holding): number {
  return h.unrealisedPnL;
}

/** Unrealised return on cost, percent. */
export function unrealisedPnLPercent(h: Holding): number {
  return h.costBasis === 0 ? 0 : (h.unrealisedPnL / h.costBasis) * 100;
}

/** Previous close implied by the current price and today's percentage change. */
export function previousClose(h: Holding): number {
  return h.currentPrice / (1 + h.dailyPnLPercent / 100);
}

/** Price in the holding's own currency, e.g. "2,915.40" or "$18.42". */
export function formatLocalPrice(h: Holding): string {
  const digits = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const text = h.currentPrice.toLocaleString('en-IN', digits);
  return h.currency === 'USD' ? `$${text}` : text;
}
