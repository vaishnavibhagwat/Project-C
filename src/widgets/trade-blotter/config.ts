import { lazy } from 'react';
import { IconHistory } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { registerWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { formatInrCompact } from '@/utils/format';
import { filterTrades, flows } from './model';
import { TradeBlotterConfigSchema, type TradeBlotterConfig, type TradeBlotterData } from './types';

export const tradeBlotterDefinition: WidgetDefinition<TradeBlotterConfig, TradeBlotterData> = {
  id: 'trade-blotter',
  name: 'Trade Blotter',
  description:
    'Simulated NSE executions for today and the previous session, with T+1 settlement dates. Times in IST.',
  category: WidgetCategory.TABLE,
  defaultSize: { w: 12, h: 10 },
  minSize: { w: 4, h: 6 },
  configSchema: {
    type: 'object',
    properties: {
      side: {
        title: 'Side',
        oneOf: [
          { const: 'ALL', title: 'All' },
          { const: 'BUY', title: 'Buys' },
          { const: 'SELL', title: 'Sells' },
        ],
      },
      status: {
        title: 'Status',
        oneOf: [
          { const: 'ALL', title: 'All' },
          { const: 'Filled', title: 'Filled (awaiting T+1)' },
          { const: 'Settling', title: 'Settling today' },
          { const: 'Settled', title: 'Settled' },
        ],
      },
      showSettlement: { type: 'boolean', title: 'Show settlement column' },
    },
  },
  defaultConfig: { side: 'ALL', status: 'ALL', showSettlement: true },
  component: lazy(() => import('./index')),
  icon: IconHistory,
  dataSource: { endpoint: 'trades/blotter', refreshIntervalMs: 5000 },
};

export function summarizeBlotter(data: TradeBlotterData, config: TradeBlotterConfig): string {
  const rows = filterTrades(data.trades, config);
  const f = flows(rows);
  const latest = rows[0];
  return (
    `${rows.length} trades. Buys ${formatInrCompact(f.buy)}, sells ${formatInrCompact(f.sell)}, net ${formatInrCompact(f.net, true)}.` +
    (latest
      ? ` Latest: ${latest.side} ${latest.quantity} ${latest.symbol} at ₹${latest.price.toFixed(2)}, settles ${latest.settlementDate}.`
      : '')
  );
}

export const tradeBlotterWidget = registerWidget(tradeBlotterDefinition, {
  configParser: TradeBlotterConfigSchema,
  isData: isEndpointData('trades/blotter'),
  isEmpty: (d) => d.trades.length === 0,
  summarize: summarizeBlotter,
  skeleton: 'table',
  preload: () => import('./index'),
});
