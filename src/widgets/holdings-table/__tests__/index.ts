import { parseEndpoint } from '@/data/api';
import { fixture } from '@/__tests__/fixtures';
import type { HoldingsTableConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('portfolio/holdings');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: HoldingsTableConfig = {
  sort: 'sector:asc,dailyPnLPercent:desc',
  columnOrder:
    'ticker,sector,dailyPnLPercent,dailyPnL,marketValue,weight,name,quantity,price,assetClass',
  hiddenColumns: 'name,quantity,assetClass',
  pageSize: '25',
  mockRows: 'off',
  filterSector: 'Financial Services',
  filterAssetClass: 'all',
  filterPnl: 'gainers',
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('portfolio/holdings');
  return parseEndpoint('portfolio/holdings', { ...base, holdings: [] });
};
