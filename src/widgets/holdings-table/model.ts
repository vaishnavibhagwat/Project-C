import type { Holding, HoldingsTableConfig } from './types';

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
      (q === '' || h.symbol.toLowerCase().includes(q) || h.name.toLowerCase().includes(q)),
  );
  const dir = config.sortDir === 'asc' ? 1 : -1;
  const key = config.sortBy;
  return rows.sort((a, b) => {
    if (key === 'symbol') return a.symbol.localeCompare(b.symbol) * dir;
    return (a[key] - b[key]) * dir;
  });
}

export function totals(rows: readonly Holding[]) {
  return rows.reduce(
    (acc, h) => ({
      marketValueInr: acc.marketValueInr + h.marketValueInr,
      dayPnlInr: acc.dayPnlInr + h.dayPnlInr,
      unrealisedPnlInr: acc.unrealisedPnlInr + h.unrealisedPnlInr,
      weightPct: acc.weightPct + h.weightPct,
    }),
    { marketValueInr: 0, dayPnlInr: 0, unrealisedPnlInr: 0, weightPct: 0 },
  );
}
