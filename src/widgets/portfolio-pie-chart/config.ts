import { lazy } from 'react';
import { IconPie } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { buildLevel, summarizePie } from './model';
import {
  PortfolioPieChartConfigSchema,
  type PortfolioPieChartConfig,
  type PortfolioPieChartData,
} from './types';

/** Brief: refresh every 30 s. Shares the holdings cache with the holdings table and treemap. */
export const PORTFOLIO_PIE_REFRESH_MS = 30_000;

export const portfolioPieChartDefinition: WidgetDefinition<
  PortfolioPieChartConfig,
  PortfolioPieChartData
> = {
  id: 'portfolio-pie-chart',
  name: 'Portfolio Pie Chart',
  description:
    'Allocation of the whole book by asset class, sector, geography or a custom field. Click a slice to drill into its breakdown.',
  category: WidgetCategory.CHART,
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 3 },
  maxSize: { w: 8, h: 8 },
  configSchema: {
    type: 'object',
    properties: {
      grouping: {
        title: 'Group by',
        oneOf: [
          { const: 'asset-class', title: 'Asset class' },
          { const: 'sector', title: 'Sector' },
          { const: 'geography', title: 'Geography' },
          { const: 'custom', title: 'Custom field' },
        ],
      },
      customField: {
        title: 'Custom field',
        description: 'Used when "Group by" is Custom field.',
        oneOf: [
          { const: 'instrument-type', title: 'Instrument type' },
          { const: 'currency', title: 'Currency' },
        ],
      },
      chartType: {
        title: 'Chart type',
        oneOf: [
          { const: 'donut', title: 'Donut' },
          { const: 'pie', title: 'Pie' },
        ],
      },
      showValueLabels: { type: 'boolean', title: 'Show value labels' },
      palette: {
        title: 'Colour palette',
        description: 'All palettes follow the active theme.',
        oneOf: [
          { const: 'theme', title: 'Theme series' },
          { const: 'monochrome', title: 'Accent shades' },
          { const: 'soft', title: 'Soft series' },
        ],
      },
    },
  },
  defaultConfig: {
    grouping: 'asset-class',
    customField: 'instrument-type',
    chartType: 'donut',
    showValueLabels: true,
    palette: 'theme',
  },
  component: lazy(() => import('./index')),
  icon: IconPie,
  dataSource: {
    endpoint: 'portfolio/holdings',
    refreshInterval: PORTFOLIO_PIE_REFRESH_MS,
    latencyProfile: 'normal',
  },
};

export function summarizePortfolioPie(
  data: PortfolioPieChartData,
  config: PortfolioPieChartConfig,
): string {
  return summarizePie(buildLevel(data, config, []));
}

export const portfolioPieChartWidget = defineWidget(portfolioPieChartDefinition, {
  configParser: PortfolioPieChartConfigSchema,
  isData: isEndpointData('portfolio/holdings'),
  isEmpty: (d) => d.holdings.length === 0,
  summarize: summarizePortfolioPie,
  skeleton: 'donut',
  preload: () => import('./index'),
});
