import { lazy } from 'react';
import { IconBars } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { registerWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { formatPct } from '@/utils/format';
import {
  ATTRIBUTION_PERIOD_OPTIONS,
  SectorAttributionConfigSchema,
  type SectorAttributionConfig,
  type SectorAttributionData,
} from './types';

export const sectorAttributionDefinition: WidgetDefinition<
  SectorAttributionConfig,
  SectorAttributionData
> = {
  id: 'sector-attribution',
  name: 'Sector Attribution',
  description:
    'Simplified single-period Brinson-Fachler attribution of equity active return vs the Nifty 50: allocation and selection by sector.',
  category: WidgetCategory.CHART,
  defaultSize: { w: 12, h: 11 },
  minSize: { w: 4, h: 7 },
  configSchema: {
    type: 'object',
    properties: {
      period: {
        title: 'Period',
        oneOf: ATTRIBUTION_PERIOD_OPTIONS.map((p) => ({ const: p, title: p })),
      },
      effect: {
        title: 'Effect shown',
        oneOf: [
          { const: 'stacked', title: 'Allocation + selection (stacked)' },
          { const: 'total', title: 'Total effect' },
          { const: 'allocation', title: 'Allocation only' },
          { const: 'selection', title: 'Selection only' },
        ],
      },
      showTable: { type: 'boolean', title: 'Show detail table (wide layouts)' },
    },
  },
  defaultConfig: { period: '3M', effect: 'stacked', showTable: true },
  component: lazy(() => import('./index')),
  icon: IconBars,
  dataSource: { endpoint: 'performance/attribution', refreshIntervalMs: 60_000 },
};

export function summarizeAttribution(
  data: SectorAttributionData,
  config: SectorAttributionConfig,
): string {
  const p = data.periods.find((x) => x.period === config.period);
  if (!p) return 'No attribution for this period.';
  const top = p.rows[0];
  const bottom = p.rows[p.rows.length - 1];
  const active = (p.portfolioReturnPct - p.benchmarkReturnPct) / 100;
  return (
    `${config.period}: equity sleeve ${formatPct(p.portfolioReturnPct / 100)} vs Nifty 50 ${formatPct(p.benchmarkReturnPct / 100)}, active ${formatPct(active)}.` +
    (top && bottom
      ? ` Largest contributor ${top.sector} ${formatPct(top.totalPct / 100)}, largest detractor ${bottom.sector} ${formatPct(bottom.totalPct / 100)}.`
      : '')
  );
}

export const sectorAttributionWidget = registerWidget(sectorAttributionDefinition, {
  configParser: SectorAttributionConfigSchema,
  isData: isEndpointData('performance/attribution'),
  isEmpty: (d) => d.periods.length === 0,
  summarize: summarizeAttribution,
  skeleton: 'bars',
  preload: () => import('./index'),
});
