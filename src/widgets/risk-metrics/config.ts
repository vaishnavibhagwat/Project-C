import { lazy } from 'react';
import { IconGauge } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { registerWidget } from '@/registry/defineWidget';
import { env } from '@/utils/env';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { buildTiles } from './model';
import { RiskMetricsConfigSchema, type RiskMetricsConfig, type RiskMetricsData } from './types';

export const riskMetricsDefinition: WidgetDefinition<RiskMetricsConfig, RiskMetricsData> = {
  id: 'risk-metrics',
  name: 'Risk-Adjusted Metrics',
  description:
    'Sharpe, Sortino, volatility, drawdown, beta, tracking error and more, computed from simulated daily NAV returns.',
  category: WidgetCategory.ANALYSIS,
  defaultSize: { w: 12, h: 4 },
  minSize: { w: 3, h: 4 },
  configSchema: {
    type: 'object',
    properties: {
      period: {
        title: 'Period for Sharpe / volatility / return',
        oneOf: [
          { const: 'full', title: 'Full history (5Y)' },
          { const: '1Y', title: 'Trailing 1 year' },
        ],
      },
      showDefinitions: { type: 'boolean', title: 'Show sub-labels' },
    },
  },
  defaultConfig: { period: 'full', showDefinitions: true },
  component: lazy(() => import('./index')),
  icon: IconGauge,
  dataSource: {
    endpoint: 'risk/metrics',
    refreshInterval: env.VITE_DATA_REFRESH_INTERVAL,
    latencyProfile: 'high',
  },
};

export function summarizeMetrics(data: RiskMetricsData, config: RiskMetricsConfig): string {
  return buildTiles(data, config)
    .slice(0, 6)
    .map((t) => `${t.label} ${t.value}`)
    .join('. ')
    .concat('.');
}

export const riskMetricsWidget = registerWidget(riskMetricsDefinition, {
  configParser: RiskMetricsConfigSchema,
  isData: isEndpointData('risk/metrics'),
  summarize: summarizeMetrics,
  skeleton: 'tiles',
  preload: () => import('./index'),
});
