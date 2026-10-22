import { unrealisedPnL, unrealisedPnLPercent } from '@/utils/holdings';
import type { Holding, HoldingSortKey, HoldingsTableConfig } from './types';

/** Numeric value used to sort by each non-text column. */
const SORT_VALUE: Record<Exclude<HoldingSortKey, 'ticker'>, (h: Holding) => number> = {
  weight: (h) => h.weight,
  dailyPnLPercent: (h) => h.dailyPnLPercent,
  marketValue: (h) => h.marketValue,
  dailyPnL: (h) => h.dailyPnL,
  unrealisedPnLPercent,
};

/** Filter by sector and free-text query, then sort. Pure, so it is cheap to test. */
export function selectHoldings(
  holdings: readonly Holding[],
  config: HoldingsTableConfig,
  query: string,
): Holding[] {
  const q = query.trim().toLowerCase();
  const rows = holdings.filter(
    (h) =>
      (config.sector === 'All' || h.sector === config.sector) &&
      (q === '' || h.ticker.toLowerCase().includes(q) || h.name.toLowerCase().includes(q)),
  );
  const dir = config.sortDir === 'asc' ? 1 : -1;
  const key = config.sortBy;
  if (key === 'ticker') return rows.sort((a, b) => a.ticker.localeCompare(b.ticker) * dir);
  const value = SORT_VALUE[key];
  return rows.sort((a, b) => (value(a) - value(b)) * dir);
}

export function totals(rows: readonly Holding[]) {
  return rows.reduce(
    (acc, h) => ({
      marketValue: acc.marketValue + h.marketValue,
      dailyPnL: acc.dailyPnL + h.dailyPnL,
      unrealisedPnL: acc.unrealisedPnL + unrealisedPnL(h),
      weight: acc.weight + h.weight,
    }),
    { marketValue: 0, dailyPnL: 0, unrealisedPnL: 0, weight: 0 },
  );
}
