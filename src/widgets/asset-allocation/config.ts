import { lazy } from 'react';
import { IconPie } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { buildSlices } from './model';
import {
  AssetAllocationConfigSchema,
  type AssetAllocationConfig,
  type AssetAllocationData,
} from './types';

export const assetAllocationDefinition: WidgetDefinition<
  AssetAllocationConfig,
  AssetAllocationData
> = {
  id: 'asset-allocation',
  name: 'Asset Allocation',
  description:
    'Allocation by asset class (whole fund) or by sector (equity sleeve). Weights always sum to 100%.',
  category: WidgetCategory.CHART,
  defaultSize: { w: 3, h: 10 },
  minSize: { w: 3, h: 7 },
  configSchema: {
    type: 'object',
    properties: {
      view: {
        title: 'Breakdown',
        oneOf: [
          { const: 'asset-class', title: 'Asset class (whole fund)' },
          { const: 'sector', title: 'Sector (equity sleeve)' },
        ],
      },
      currency: {
        title: 'Currency',
        oneOf: [
          { const: 'INR', title: 'INR (₹)' },
          { const: 'USD', title: 'USD ($)' },
        ],
      },
      showLegend: { type: 'boolean', title: 'Show legend table' },
    },
  },
  defaultConfig: { view: 'asset-class', currency: 'INR', showLegend: true },
  component: lazy(() => import('./index')),
  icon: IconPie,
  dataSource: {
    endpoint: 'portfolio/allocation',
    wsChannel: 'portfolio.positions',
    refreshInterval: 15_000,
    latencyProfile: 'normal',
  },
};

export function summarizeAllocation(
  data: AssetAllocationData,
  config: AssetAllocationConfig,
): string {
  const slices = buildSlices(data, config);
  const parts = slices.map((s) => `${s.label} ${s.weightPct.toFixed(1)}%`).join(', ');
  return `${config.view === 'sector' ? 'Equity sector' : 'Asset class'} allocation: ${parts}.`;
}

export const assetAllocationWidget = defineWidget(assetAllocationDefinition, {
  configParser: AssetAllocationConfigSchema,
  isData: isEndpointData('portfolio/allocation'),
  isEmpty: (d) => d.assetClasses.length === 0,
  summarize: summarizeAllocation,
  skeleton: 'donut',
  preload: () => import('./index'),
});
