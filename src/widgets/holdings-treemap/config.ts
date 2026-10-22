import { lazy } from 'react';
import { IconTreemap } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { registerWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { formatPct } from '@/utils/format';
import {
  HoldingsTreemapConfigSchema,
  type HoldingsTreemapConfig,
  type HoldingsTreemapData,
} from './types';

export const holdingsTreemapDefinition: WidgetDefinition<
  HoldingsTreemapConfig,
  HoldingsTreemapData
> = {
  id: 'holdings-treemap',
  name: 'Holdings Treemap',
  description:
    'Equity holdings sized by market value and coloured by day change or unrealised P&L. D3 squarified treemap.',
  category: WidgetCategory.ANALYSIS,
  defaultSize: { w: 6, h: 10 },
  minSize: { w: 3, h: 6 },
  configSchema: {
    type: 'object',
    properties: {
      groupBy: {
        title: 'Group by',
        oneOf: [
          { const: 'sector', title: 'Sector' },
          { const: 'none', title: 'No grouping' },
        ],
      },
      colorBy: {
        title: 'Colour by',
        oneOf: [
          { const: 'dayChange', title: 'Day change %' },
          { const: 'unrealised', title: 'Unrealised P&L %' },
        ],
      },
      capPct: {
        type: 'number',
        title: 'Colour scale cap (%)',
        minimum: 0.5,
        maximum: 50,
        multipleOf: 0.5,
      },
    },
  },
  defaultConfig: { groupBy: 'sector', colorBy: 'dayChange', capPct: 3 },
  component: lazy(() => import('./index')),
  icon: IconTreemap,
  dataSource: {
    endpoint: 'portfolio/holdings',
    wsChannel: 'portfolio.positions',
    refreshInterval: 5000,
    latencyProfile: 'low',
  },
};

export function summarizeTreemap(data: HoldingsTreemapData, config: HoldingsTreemapConfig): string {
  const top = [...data.holdings].sort((a, b) => b.weightPct - a.weightPct).slice(0, 3);
  const metric = config.colorBy === 'dayChange' ? 'day change' : 'unrealised P&L';
  const parts = top.map(
    (h) =>
      `${h.symbol} ${h.weightPct.toFixed(1)}% (${metric} ${formatPct((config.colorBy === 'dayChange' ? h.dayChangePct : h.unrealisedPnlPct) / 100)})`,
  );
  return `${data.holdings.length} holdings. Largest: ${parts.join(', ')}.`;
}

export const holdingsTreemapWidget = registerWidget(holdingsTreemapDefinition, {
  configParser: HoldingsTreemapConfigSchema,
  isData: isEndpointData('portfolio/holdings'),
  isEmpty: (d) => d.holdings.length === 0,
  summarize: summarizeTreemap,
  skeleton: 'treemap',
  preload: () => import('./index'),
});
