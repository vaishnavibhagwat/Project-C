import { lazy } from 'react';
import { IconHeatmap } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { buildMatrix, selectSeries, summarizeMatrix } from './model';
import {
  CorrelationMatrixConfigSchema,
  type CorrelationMatrixConfig,
  type CorrelationMatrixData,
} from './types';

/** Brief: refresh every 5 minutes (daily returns change only after the close). */
export const CORRELATION_REFRESH_MS = 5 * 60_000;

export const correlationMatrixDefinition: WidgetDefinition<
  CorrelationMatrixConfig,
  CorrelationMatrixData
> = {
  id: 'correlation-matrix',
  name: 'Correlation Matrix',
  description:
    'Pairwise correlation of daily returns for the largest holdings or the sectors, over 30 to 252 days. Click a cell for a scatter plot.',
  category: WidgetCategory.ANALYSIS,
  defaultSize: { w: 4, h: 4 },
  minSize: { w: 3, h: 3 },
  maxSize: { w: 8, h: 10 },
  configSchema: {
    type: 'object',
    properties: {
      subject: {
        title: 'Compare',
        oneOf: [
          { const: 'holdings', title: 'Largest holdings' },
          { const: 'sectors', title: 'Equity sectors' },
        ],
      },
      count: {
        title: 'How many',
        oneOf: [
          { const: '10', title: '10' },
          { const: '15', title: '15' },
        ],
      },
      lookback: {
        title: 'Lookback',
        oneOf: ['30', '60', '90', '252'].map((d) => ({ const: d, title: `${d} trading days` })),
      },
    },
  },
  defaultConfig: { subject: 'holdings', count: '10', lookback: '90' },
  component: lazy(() => import('./index')),
  icon: IconHeatmap,
  dataSource: {
    endpoint: 'risk/returns',
    refreshInterval: CORRELATION_REFRESH_MS,
    latencyProfile: 'high',
  },
};

export function summarizeCorrelations(
  data: CorrelationMatrixData,
  config: CorrelationMatrixConfig,
): string {
  const { dates, series } = selectSeries(data, config);
  return summarizeMatrix(series, buildMatrix(series), dates.length);
}

export const correlationMatrixWidget = defineWidget(correlationMatrixDefinition, {
  configParser: CorrelationMatrixConfigSchema,
  isData: isEndpointData('risk/returns'),
  isEmpty: (d) => d.dates.length < 2,
  summarize: summarizeCorrelations,
  skeleton: 'heatmap',
  preload: () => import('./index'),
});
