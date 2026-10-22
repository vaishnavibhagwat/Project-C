import type { Holding } from '@/types';

/** Unrealised profit or loss: quantity x (current price - average cost), in the holding currency. */
export function unrealisedPnL(h: Holding): number {
  return h.quantity * (h.currentPrice - h.averageCost);
}

/** Unrealised return on cost, percent. */
export function unrealisedPnLPercent(h: Holding): number {
  return h.averageCost === 0 ? 0 : (h.currentPrice / h.averageCost - 1) * 100;
}

/** Previous close implied by the current price and today's percentage change. */
export function previousClose(h: Holding): number {
  return h.currentPrice / (1 + h.dailyPnLPercent / 100);
}
