import { lazy } from 'react';
import { IconTable } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { formatInrCompact, formatPct } from '@/utils/format';
import { sortedHoldings, totals } from './model';
import {
  HoldingsTableConfigSchema,
  type HoldingsTableConfig,
  type HoldingsTableData,
} from './types';

/** Brief: poll every 10 s; live prices arrive in between on the simulated WebSocket. */
export const HOLDINGS_TABLE_REFRESH_MS = 10_000;

export const holdingsTableDefinition: WidgetDefinition<HoldingsTableConfig, HoldingsTableData> = {
  id: 'holdings-table',
  name: 'Holdings',
  description:
    'Every position of the book with live simulated prices. Multi-column sort (shift-click), search, column picker, drag to reorder, pages and CSV export.',
  category: WidgetCategory.TABLE,
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 4, h: 3 },
  maxSize: { w: 12, h: 12 },
  // Sort, column order and hidden columns are set from the table itself (headers, Columns
  // menu): readOnly keeps them out of the settings form.
  configSchema: {
    type: 'object',
    properties: {
      sort: {
        type: 'string',
        title: 'Sort',
        readOnly: true,
        maxLength: 300,
        pattern: '^([a-zA-Z]+:(asc|desc))?(,[a-zA-Z]+:(asc|desc))*$',
      },
      columnOrder: {
        type: 'string',
        title: 'Column order',
        readOnly: true,
        maxLength: 300,
        pattern: '^[a-zA-Z,]*$',
      },
      hiddenColumns: {
        type: 'string',
        title: 'Hidden columns',
        readOnly: true,
        maxLength: 300,
        pattern: '^[a-zA-Z,]*$',
      },
      pageSize: {
        title: 'Rows per page',
        oneOf: [
          { const: 'all', title: 'All rows (virtual scrolling)' },
          { const: '25', title: '25' },
          { const: '50', title: '50' },
          { const: '100', title: '100' },
        ],
      },
      mockRows: {
        title: 'Performance demo rows',
        description: 'Replace the book with generated rows to try the table at scale.',
        oneOf: [
          { const: 'off', title: 'Off (the real book)' },
          { const: '1000', title: '1,000 generated rows' },
          { const: '5000', title: '5,000 generated rows' },
        ],
      },
    },
  },
  defaultConfig: {
    sort: 'weight:desc',
    columnOrder: '',
    hiddenColumns: 'sector,assetClass',
    pageSize: 'all',
    mockRows: 'off',
  },
  component: lazy(() => import('./index')),
  icon: IconTable,
  dataSource: {
    endpoint: 'portfolio/holdings',
    wsChannel: 'portfolio.positions',
    refreshInterval: HOLDINGS_TABLE_REFRESH_MS,
    latencyProfile: 'low',
  },
};

export function summarizeHoldings(data: HoldingsTableData, config: HoldingsTableConfig): string {
  const rows = sortedHoldings(data.holdings, config);
  const t = totals(rows);
  const top = rows[0];
  return (
    `${rows.length} holdings, value ${formatInrCompact(t.marketValue)}, ` +
    `day P&L ${formatInrCompact(t.dailyPnL, true)}.` +
    (top
      ? ` First row ${top.ticker}, weight ${top.weight.toFixed(2)}%, day ${formatPct(top.dailyPnLPercent / 100)}.`
      : '')
  );
}

export const holdingsTableWidget = defineWidget(holdingsTableDefinition, {
  configParser: HoldingsTableConfigSchema,
  isData: isEndpointData('portfolio/holdings'),
  isEmpty: (d) => d.holdings.length === 0,
  summarize: summarizeHoldings,
  skeleton: 'table',
  preload: () => import('./index'),
});
