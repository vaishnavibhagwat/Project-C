import { lazy } from 'react';
import { IconTrendingUp } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { summarizeMovers } from './model';
import {
  MOVER_COUNTS,
  TopMoversConfigSchema,
  type TopMoversConfig,
  type TopMoversData,
} from './types';

export const TOP_MOVERS_WIDGET_ID = 'demo-top-movers';

export const topMoversDefinition: WidgetDefinition<TopMoversConfig, TopMoversData> = {
  id: TOP_MOVERS_WIDGET_ID,
  name: 'Top Movers',
  description:
    'Demo third-party plugin: the day’s biggest gainers and losers of the book, by % move or rupee P&L.',
  category: WidgetCategory.ANALYSIS,
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 3 },
  maxSize: { w: 8, h: 6 },
  configSchema: {
    type: 'object',
    properties: {
      count: {
        title: 'Rows per list',
        oneOf: MOVER_COUNTS.map((c) => ({ const: c, title: c })),
      },
      rankBy: {
        title: 'Rank by',
        oneOf: [
          { const: 'percent', title: 'Day % move' },
          { const: 'value', title: 'Day P&L (₹)' },
        ],
      },
    },
  },
  defaultConfig: { count: '5', rankBy: 'percent' },
  component: lazy(() => import('./TopMovers')),
  icon: IconTrendingUp,
  dataSource: {
    endpoint: 'portfolio/holdings',
    wsChannel: 'ws://mock/portfolio/MER-IMAF-01/prices',
    refreshInterval: 10_000,
    latencyProfile: 'low',
  },
};

export const topMoversWidget = defineWidget(topMoversDefinition, {
  configParser: TopMoversConfigSchema,
  isData: isEndpointData('portfolio/holdings'),
  isEmpty: (d) => d.holdings.length === 0,
  summarize: summarizeMovers,
  skeleton: 'feed',
  preload: () => import('./TopMovers'),
});
