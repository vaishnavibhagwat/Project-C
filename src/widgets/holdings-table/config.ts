import { lazy } from 'react';
import { IconTable } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { registerWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { formatInrCompact, formatPct } from '@/utils/format';
import { selectHoldings, totals } from './model';
import {
  HoldingsTableConfigSchema,
  SECTOR_FILTERS,
  type HoldingsTableConfig,
  type HoldingsTableData,
} from './types';

export const holdingsTableDefinition: WidgetDefinition<HoldingsTableConfig, HoldingsTableData> = {
  id: 'holdings-table',
  name: 'Holdings',
  description:
    'Position-level table of the equity sleeve with live simulated prices. Virtualised for large books; sortable and filterable.',
  category: WidgetCategory.TABLE,
  defaultSize: { w: 8, h: 11 },
  minSize: { w: 4, h: 6 },
  configSchema: {
    type: 'object',
    properties: {
      sortBy: {
        title: 'Sort by',
        oneOf: [
          { const: 'weight', title: 'Weight' },
          { const: 'marketValue', title: 'Market value' },
          { const: 'dailyPnLPercent', title: 'Day change %' },
          { const: 'dailyPnL', title: 'Day P&L' },
          { const: 'unrealisedPnLPercent', title: 'Unrealised P&L %' },
          { const: 'ticker', title: 'Symbol' },
        ],
      },
      sortDir: {
        title: 'Direction',
        oneOf: [
          { const: 'desc', title: 'Descending' },
          { const: 'asc', title: 'Ascending' },
        ],
      },
      sector: {
        title: 'Sector filter',
        oneOf: SECTOR_FILTERS.map((s) => ({ const: s, title: s })),
      },
      showPnl: { type: 'boolean', title: 'Show P&L columns' },
    },
  },
  defaultConfig: { sortBy: 'weight', sortDir: 'desc', sector: 'All', showPnl: true },
  component: lazy(() => import('./index')),
  icon: IconTable,
  dataSource: {
    endpoint: 'portfolio/holdings',
    wsChannel: 'portfolio.positions',
    refreshInterval: 5000,
    latencyProfile: 'low',
  },
};

export function summarizeHoldings(data: HoldingsTableData, config: HoldingsTableConfig): string {
  const rows = selectHoldings(data.holdings, config, '');
  const t = totals(rows);
  const top = rows[0];
  return (
    `${rows.length} holdings${config.sector === 'All' ? '' : ` in ${config.sector}`}, value ${formatInrCompact(t.marketValue)}, ` +
    `day P&L ${formatInrCompact(t.dailyPnL, true)}.` +
    (top
      ? ` First row ${top.ticker}, weight ${top.weight.toFixed(2)}%, day ${formatPct(top.dailyPnLPercent / 100)}.`
      : '')
  );
}

export const holdingsTableWidget = registerWidget(holdingsTableDefinition, {
  configParser: HoldingsTableConfigSchema,
  isData: isEndpointData('portfolio/holdings'),
  isEmpty: (d) => d.holdings.length === 0,
  summarize: summarizeHoldings,
  skeleton: 'table',
  preload: () => import('./index'),
});
