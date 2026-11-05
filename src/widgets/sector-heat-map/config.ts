import { lazy } from 'react';
import { IconTreemap } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { scopedHoldings, sectorCells, summarizeHeatMap } from './model';
import {
  SectorHeatMapConfigSchema,
  type SectorHeatMapConfig,
  type SectorHeatMapData,
} from './types';

/** Brief: refresh every 15 s (intraday marks move during the NSE session). */
export const SECTOR_HEAT_MAP_REFRESH_MS = 15_000;

export const sectorHeatMapDefinition: WidgetDefinition<SectorHeatMapConfig, SectorHeatMapData> = {
  id: 'sector-heat-map',
  name: 'Sector Heat Map',
  description:
    'Squarified treemap of sectors sized by market value and coloured by day P&L. Click a sector to see its holdings.',
  category: WidgetCategory.CHART,
  defaultSize: { w: 4, h: 4 },
  minSize: { w: 3, h: 3 },
  maxSize: { w: 12, h: 10 },
  configSchema: {
    type: 'object',
    properties: {
      colorScale: {
        title: 'Colour scale',
        oneOf: [
          { const: 'green-red', title: 'Green / red' },
          { const: 'blue-orange', title: 'Blue / orange (colour-blind friendly)' },
        ],
      },
      capPct: {
        type: 'number',
        title: 'Full colour at (± %)',
        description: 'Day P&L at which a cell reaches full colour strength.',
        minimum: 0.5,
        maximum: 10,
      },
      scope: {
        title: 'Holdings',
        oneOf: [
          { const: 'equity', title: 'Equity only' },
          { const: 'all', title: 'Whole book (non-equity by asset class)' },
        ],
      },
    },
  },
  defaultConfig: { colorScale: 'green-red', capPct: 2, scope: 'equity' },
  component: lazy(() => import('./index')),
  icon: IconTreemap,
  dataSource: {
    endpoint: 'portfolio/holdings',
    refreshInterval: SECTOR_HEAT_MAP_REFRESH_MS,
    latencyProfile: 'normal',
  },
};

export function summarizeSectorHeatMap(
  data: SectorHeatMapData,
  config: SectorHeatMapConfig,
): string {
  return `Sectors by day P&L. ${summarizeHeatMap(sectorCells(scopedHoldings(data, config)))}`;
}

export const sectorHeatMapWidget = defineWidget(sectorHeatMapDefinition, {
  configParser: SectorHeatMapConfigSchema,
  isData: isEndpointData('portfolio/holdings'),
  isEmpty: (d) => d.holdings.length === 0,
  summarize: summarizeSectorHeatMap,
  skeleton: 'treemap',
  preload: () => import('./index'),
});
