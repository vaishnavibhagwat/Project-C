import { lazy } from 'react';
import { isEndpointData } from '@/data/api';
import { IconTiles } from '@/components/Icons';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { formatInrCompact, formatPct, formatUsdCompact } from '@/utils/format';
import {
  PortfolioOverviewConfigSchema,
  type PortfolioOverviewConfig,
  type PortfolioOverviewData,
} from './types';

export const portfolioOverviewDefinition: WidgetDefinition<
  PortfolioOverviewConfig,
  PortfolioOverviewData
> = {
  id: 'portfolio-overview',
  name: 'Portfolio Overview',
  description:
    'Headline figures: AUM at last close (exactly USD 45.0B), intraday market value, day P&L, NAV per unit and period returns.',
  category: WidgetCategory.ANALYSIS,
  defaultSize: { w: 12, h: 2 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 3 },
  configSchema: {
    type: 'object',
    properties: {
      currency: {
        title: 'Primary currency',
        description: 'Money figures are converted at the fixed configured USD/INR rate.',
        oneOf: [
          { const: 'INR', title: 'INR (₹)' },
          { const: 'USD', title: 'USD ($)' },
        ],
      },
      showReturns: { type: 'boolean', title: 'Show MTD / YTD / 1Y returns' },
      showBenchmark: { type: 'boolean', title: 'Show Nifty 50 day change' },
    },
    required: ['currency', 'showReturns', 'showBenchmark'],
  },
  defaultConfig: { currency: 'INR', showReturns: true, showBenchmark: true },
  component: lazy(() => import('./index')),
  icon: IconTiles,
  dataSource: {
    endpoint: 'portfolio/summary',
    wsChannel: 'portfolio.summary',
    refreshInterval: 5000,
    latencyProfile: 'low',
  },
};

export function summarizePortfolioOverview(d: PortfolioOverviewData): string {
  return (
    `AUM ${formatUsdCompact(d.aumUsd)} (${formatInrCompact(d.aum)}) at last close. ` +
    `Intraday market value ${formatInrCompact(d.marketValueInr)}, day P&L ${formatInrCompact(d.dailyPnL, true)} ` +
    `(${formatPct(d.dailyPnLPercent / 100)}). NAV per unit ${d.navPerUnit.toFixed(2)}.`
  );
}

export const portfolioOverviewWidget = defineWidget(portfolioOverviewDefinition, {
  configParser: PortfolioOverviewConfigSchema,
  isData: isEndpointData('portfolio/summary'),
  summarize: summarizePortfolioOverview,
  skeleton: 'tiles',
  preload: () => import('./index'),
});
