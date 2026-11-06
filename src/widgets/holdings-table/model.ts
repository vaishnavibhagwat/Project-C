import type { DataTableColumn } from '@/components/DataTable/tableModel';
import { parseSort, sortRows } from '@/components/DataTable/tableModel';
import {
  HOLDING_COLUMN_IDS,
  type Holding,
  type HoldingColumnId,
  type HoldingsTableConfig,
} from './types';

const roundTo = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Column definitions without cell rendering (shared by the summary, tests and the widget). */
export const HOLDING_COLUMNS: readonly (DataTableColumn<Holding> & { id: HoldingColumnId })[] = [
  { id: 'ticker', header: 'Ticker', value: (h) => h.ticker, minWidth: 96 },
  { id: 'name', header: 'Name', value: (h) => h.name, minWidth: 160 },
  {
    id: 'quantity',
    header: 'Qty',
    value: (h) => h.quantity,
    align: 'right',
    minWidth: 72,
  },
  {
    id: 'price',
    header: 'Price',
    value: (h) => h.currentPrice,
    align: 'right',
    minWidth: 88,
    csvHeader: 'Price (local currency)',
  },
  {
    id: 'marketValue',
    header: 'Market value',
    value: (h) => h.marketValue,
    align: 'right',
    minWidth: 96,
    csvHeader: 'Market value (INR)',
    csv: (h) => roundTo(h.marketValue, 2),
  },
  {
    id: 'dailyPnL',
    header: 'Day P&L',
    value: (h) => h.dailyPnL,
    align: 'right',
    minWidth: 88,
    csvHeader: 'Day P&L (INR)',
    csv: (h) => roundTo(h.dailyPnL, 2),
  },
  {
    id: 'dailyPnLPercent',
    header: 'Day P&L %',
    value: (h) => h.dailyPnLPercent,
    align: 'right',
    minWidth: 80,
    csv: (h) => roundTo(h.dailyPnLPercent, 4),
  },
  {
    id: 'weight',
    header: 'Weight',
    value: (h) => h.weight,
    align: 'right',
    minWidth: 64,
    csvHeader: 'Weight (%)',
    csv: (h) => roundTo(h.weight, 4),
  },
  { id: 'sector', header: 'Sector', value: (h) => h.sector ?? '', minWidth: 140 },
  { id: 'assetClass', header: 'Asset class', value: (h) => h.assetClass, minWidth: 96 },
];

export const holdingSort = (config: HoldingsTableConfig) =>
  parseSort(config.sort, HOLDING_COLUMN_IDS);

/** Rows in the configured sort order (no search: that is local to the table). */
export function sortedHoldings(holdings: readonly Holding[], config: HoldingsTableConfig) {
  return sortRows(holdings, HOLDING_COLUMNS, holdingSort(config));
}

export function totals(rows: readonly Holding[]) {
  const t = rows.reduce(
    (acc, h) => ({
      marketValue: acc.marketValue + h.marketValue,
      dailyPnL: acc.dailyPnL + h.dailyPnL,
      weight: acc.weight + h.weight,
    }),
    { marketValue: 0, dailyPnL: 0, weight: 0 },
  );
  const previous = t.marketValue - t.dailyPnL;
  return { ...t, dailyPnLPercent: previous > 0 ? (t.dailyPnL / previous) * 100 : 0 };
}

/** The holdings passing every filter: sector, asset class and the sign of today's P&L. */
export function filterHoldings(
  rows: readonly Holding[],
  config: Pick<HoldingsTableConfig, 'filterSector' | 'filterAssetClass' | 'filterPnl'>,
): Holding[] {
  return rows.filter(
    (h) =>
      (config.filterSector === 'all' ||
        (config.filterSector === 'none' ? h.sector === null : h.sector === config.filterSector)) &&
      (config.filterAssetClass === 'all' || h.assetClass === config.filterAssetClass) &&
      (config.filterPnl === 'all' ||
        (config.filterPnl === 'gainers' ? h.dailyPnL > 0 : h.dailyPnL < 0)),
  );
}

export const activeFilterCount = (config: HoldingsTableConfig) =>
  [config.filterSector, config.filterAssetClass, config.filterPnl].filter((f) => f !== 'all')
    .length;
