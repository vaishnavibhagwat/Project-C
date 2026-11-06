import { lazy } from 'react';
import { IconBars } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { env } from '@/utils/env';
import { basisFromConfig, contributionSummary } from './model';
import {
  RiskContributionConfigSchema,
  type RiskContributionConfig,
  type RiskContributionWidgetData,
} from './types';

export const riskContributionDefinition: WidgetDefinition<
  RiskContributionConfig,
  RiskContributionWidgetData
> = {
  id: 'risk-contribution',
  name: 'Risk Contribution',
  description:
    'Each holding’s contribution to portfolio VaR (Euler allocation on the 252-day covariance). Follows the Risk page’s confidence and horizon.',
  category: WidgetCategory.CHART,
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 4, h: 3 },
  maxSize: { w: 12, h: 8 },
  configSchema: {
    type: 'object',
    properties: {
      top: {
        title: 'Positions shown',
        oneOf: ['10', '15', '20'].map((n) => ({ const: n, title: n })),
      },
      confidence: {
        title: 'Confidence (outside the Risk page)',
        oneOf: [
          { const: '95', title: '95%' },
          { const: '99', title: '99%' },
        ],
      },
      horizonDays: {
        title: 'Horizon (outside the Risk page)',
        oneOf: [
          { const: '1', title: '1 day' },
          { const: '10', title: '10 days (√10 scaling)' },
        ],
      },
      measure: {
        title: 'Measure',
        oneOf: [
          { const: 'var', title: 'Component VaR (₹)' },
          { const: 'share', title: 'Share of total risk (%)' },
        ],
      },
    },
  },
  defaultConfig: { top: '15', confidence: '99', horizonDays: '1', measure: 'var' },
  component: lazy(() => import('./index')),
  icon: IconBars,
  dataSource: {
    endpoint: 'risk/contributions',
    refreshInterval: env.VITE_DATA_REFRESH_INTERVAL,
    latencyProfile: 'high',
  },
};

export const riskContributionWidget = defineWidget(riskContributionDefinition, {
  configParser: RiskContributionConfigSchema,
  isData: isEndpointData('risk/contributions'),
  isEmpty: (d) => d.positions.length === 0 || d.portfolioSigmaInr === 0,
  summarize: (data, config) =>
    contributionSummary(data, basisFromConfig(config), Number(config.top)),
  skeleton: 'bars',
  preload: () => import('./index'),
});
