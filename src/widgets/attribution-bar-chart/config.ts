import { lazy } from 'react';
import { IconBars } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { attributeWindow, periodWindows, summarizeWindow } from './model';
import {
  AttributionBarChartConfigSchema,
  type AttributionBarChartConfig,
  type AttributionBarChartData,
} from './types';

/** On demand (Refresh button only); data counts as stale after 2x this. */
export const ATTRIBUTION_STALE_AFTER_MS = 30 * 60_000;

export const attributionBarChartDefinition: WidgetDefinition<
  AttributionBarChartConfig,
  AttributionBarChartData
> = {
  id: 'attribution-bar-chart',
  name: 'Attribution Bars',
  description:
    'Brinson allocation, selection and interaction by sector, beta factor or asset class, for this month, last month and the same month last year. Click a bar for holding contributions.',
  category: WidgetCategory.CHART,
  defaultSize: { w: 5, h: 3 },
  minSize: { w: 4, h: 3 },
  maxSize: { w: 12, h: 8 },
  configSchema: {
    type: 'object',
    properties: {
      grouping: {
        title: 'Attribute by',
        oneOf: [
          { const: 'sector', title: 'Sector (equity vs Nifty 50)' },
          { const: 'factor', title: 'Beta factor (equity vs Nifty 50)' },
          { const: 'asset-class', title: 'Asset class (book vs policy benchmark)' },
        ],
      },
      layout: {
        title: 'Bars',
        oneOf: [
          { const: 'stacked', title: 'Stacked' },
          { const: 'grouped', title: 'Grouped' },
        ],
      },
      unit: {
        title: 'Units',
        oneOf: [
          { const: 'bps', title: 'Absolute (basis points)' },
          { const: 'pct', title: 'Relative (% of active return)' },
        ],
      },
      compare: { type: 'boolean', title: 'Compare periods side by side' },
      period: {
        title: 'Period',
        oneOf: [
          { const: 'mtd', title: 'This month' },
          { const: 'prev', title: 'Last month' },
          { const: 'yoy', title: 'Same month last year' },
        ],
      },
    },
  },
  defaultConfig: {
    grouping: 'sector',
    layout: 'stacked',
    unit: 'bps',
    compare: false,
    period: 'mtd',
  },
  component: lazy(() => import('./index')),
  icon: IconBars,
  dataSource: {
    endpoint: 'performance/attribution-inputs',
    refreshInterval: ATTRIBUTION_STALE_AFTER_MS,
    latencyProfile: 'high',
    onDemand: true,
  },
};

export function summarizeAttributionBars(
  data: AttributionBarChartData,
  config: AttributionBarChartConfig,
): string {
  const windows = periodWindows(data.dates);
  const w = windows.find((x) => x.key === config.period) ?? windows[0];
  return w ? summarizeWindow(attributeWindow(data, config.grouping, w), config.grouping) : '';
}

export const attributionBarChartWidget = defineWidget(attributionBarChartDefinition, {
  configParser: AttributionBarChartConfigSchema,
  isData: isEndpointData('performance/attribution-inputs'),
  isEmpty: (d) => d.dates.length < 2,
  summarize: summarizeAttributionBars,
  skeleton: 'bars',
  preload: () => import('./index'),
});
