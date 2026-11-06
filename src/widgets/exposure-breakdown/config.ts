import { lazy } from 'react';
import { IconLayers } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { exposureSummary } from './model';
import {
  ExposureBreakdownConfigSchema,
  type ExposureBreakdownConfig,
  type ExposureBreakdownData,
} from './types';

export const exposureBreakdownDefinition: WidgetDefinition<
  ExposureBreakdownConfig,
  ExposureBreakdownData
> = {
  id: 'exposure-breakdown',
  name: 'Exposure Breakdown',
  description:
    'Economic exposure (futures at notional, options delta-adjusted) against market value, by asset class, sector, region or currency, with gross and net exposure.',
  category: WidgetCategory.ANALYSIS,
  defaultSize: { w: 4, h: 4 },
  minSize: { w: 3, h: 3 },
  maxSize: { w: 8, h: 8 },
  configSchema: {
    type: 'object',
    properties: {
      dimension: {
        title: 'Group by',
        oneOf: [
          { const: 'asset-class', title: 'Asset class' },
          { const: 'sector', title: 'Sector' },
          { const: 'geography', title: 'Region' },
          { const: 'currency', title: 'Currency' },
        ],
      },
      showMarketValue: { type: 'boolean', title: 'Show market value beside exposure' },
    },
  },
  defaultConfig: { dimension: 'asset-class', showMarketValue: true },
  component: lazy(() => import('./index')),
  icon: IconLayers,
  dataSource: {
    endpoint: 'risk/exposure',
    wsChannel: 'ws://mock/portfolio/MER-IMAF-01/prices',
    refreshInterval: 15_000,
    latencyProfile: 'normal',
  },
};

export const exposureBreakdownWidget = defineWidget(exposureBreakdownDefinition, {
  configParser: ExposureBreakdownConfigSchema,
  isData: isEndpointData('risk/exposure'),
  isEmpty: (d) => d.positions.length === 0,
  summarize: exposureSummary,
  skeleton: 'bars',
  preload: () => import('./index'),
});
