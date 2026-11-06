import { lazy } from 'react';
import { IconLineChart } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { env } from '@/utils/env';
import { rollingVolatility, volSummary } from './model';
import {
  VolatilityHistoryConfigSchema,
  type VolatilityHistoryConfig,
  type VolatilityHistoryData,
} from './types';

export const volatilityHistoryDefinition: WidgetDefinition<
  VolatilityHistoryConfig,
  VolatilityHistoryData
> = {
  id: 'volatility-history',
  name: 'Volatility History',
  description:
    'Rolling annualised volatility of the fund and the Nifty 50 (21, 63 or 126-day window) over 1 to 5 years.',
  category: WidgetCategory.CHART,
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 4, h: 3 },
  maxSize: { w: 12, h: 8 },
  configSchema: {
    type: 'object',
    properties: {
      window: {
        title: 'Rolling window',
        oneOf: [
          { const: '21', title: '21 trading days (~1 month)' },
          { const: '63', title: '63 trading days (~3 months)' },
          { const: '126', title: '126 trading days (~6 months)' },
        ],
      },
      range: {
        title: 'Range',
        oneOf: ['1Y', '3Y', '5Y'].map((r) => ({ const: r, title: r })),
      },
      showBenchmark: { type: 'boolean', title: 'Show Nifty 50' },
    },
  },
  defaultConfig: { window: '63', range: '3Y', showBenchmark: true },
  component: lazy(() => import('./index')),
  icon: IconLineChart,
  dataSource: {
    endpoint: 'portfolio/nav-history',
    refreshInterval: env.VITE_DATA_REFRESH_INTERVAL,
    latencyProfile: 'high',
  },
};

export const volatilityHistoryWidget = defineWidget(volatilityHistoryDefinition, {
  configParser: VolatilityHistoryConfigSchema,
  isData: isEndpointData('portfolio/nav-history'),
  isEmpty: (d) => d.points.length < 2,
  summarize: (data, config) => volSummary(rollingVolatility(data, config), config),
  skeleton: 'line-chart',
  preload: () => import('./index'),
});
