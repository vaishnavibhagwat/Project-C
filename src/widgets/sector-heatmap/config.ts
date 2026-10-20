import { lazy } from 'react';
import { IconHeatmap } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { registerWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { formatPct } from '@/utils/format';
import { buildHeatModel } from './model';
import {
  SectorHeatmapConfigSchema,
  type SectorHeatmapConfig,
  type SectorHeatmapData,
} from './types';

export const sectorHeatmapDefinition: WidgetDefinition<SectorHeatmapConfig, SectorHeatmapData> = {
  id: 'sector-heatmap',
  name: 'Sector Returns Heat Map',
  description:
    'Daily returns of each sector in the equity sleeve (holdings-weighted), plus the live simulated session. Built with D3 scales.',
  category: WidgetCategory.ANALYSIS,
  defaultSize: { w: 6, h: 10 },
  minSize: { w: 4, h: 7 },
  configSchema: {
    type: 'object',
    properties: {
      days: {
        title: 'Sessions',
        oneOf: [
          { const: '5', title: 'Last 5 sessions' },
          { const: '10', title: 'Last 10 sessions' },
          { const: '20', title: 'Last 20 sessions' },
        ],
      },
      sortBy: {
        title: 'Sort rows by',
        oneOf: [
          { const: 'weight', title: 'Sector weight' },
          { const: 'latest', title: 'Latest return' },
          { const: 'name', title: 'Name' },
        ],
      },
      showValues: { type: 'boolean', title: 'Show values in cells' },
      capPct: {
        type: 'number',
        title: 'Colour scale cap (%)',
        description: 'Returns beyond ± this value use full colour intensity.',
        minimum: 0.5,
        maximum: 5,
        multipleOf: 0.5,
      },
    },
  },
  defaultConfig: { days: '10', sortBy: 'weight', showValues: true, capPct: 2 },
  component: lazy(() => import('./index')),
  icon: IconHeatmap,
  dataSource: { endpoint: 'market/sector-returns', refreshIntervalMs: 15_000 },
};

export function summarizeHeatmap(data: SectorHeatmapData, config: SectorHeatmapConfig): string {
  const m = buildHeatModel(data, config);
  const sorted = [...m.rows].sort((a, b) => b.latest - a.latest);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  if (!best || !worst) return 'No sector data.';
  const col = m.columns[m.columns.length - 1];
  return `${col?.intraday ? 'Live session' : 'Latest session'}: best sector ${best.sector} ${formatPct(best.latest / 100)}, weakest ${worst.sector} ${formatPct(worst.latest / 100)}.`;
}

export const sectorHeatmapWidget = registerWidget(sectorHeatmapDefinition, {
  configParser: SectorHeatmapConfigSchema,
  isData: isEndpointData('market/sector-returns'),
  isEmpty: (d) => d.cells.length === 0,
  summarize: summarizeHeatmap,
  skeleton: 'heatmap',
  preload: () => import('./index'),
});
