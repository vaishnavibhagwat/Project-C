import { lazy } from 'react';
import { IconAreaChart } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { env } from '@/utils/env';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { formatPct } from '@/utils/format';
import { formatDateKey } from '@/utils/time';
import { buildDrawdown } from './model';
import {
  DRAWDOWN_RANGES,
  DrawdownConfigSchema,
  type DrawdownConfig,
  type DrawdownData,
} from './types';

export const drawdownDefinition: WidgetDefinition<DrawdownConfig, DrawdownData> = {
  id: 'drawdown',
  name: 'Drawdown',
  description:
    'Underwater chart: percentage below the running NAV high-water mark, with the worst drawdown in the window marked.',
  category: WidgetCategory.CHART,
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 3, h: 3 },
  configSchema: {
    type: 'object',
    properties: {
      range: { title: 'Range', oneOf: DRAWDOWN_RANGES.map((r) => ({ const: r, title: r })) },
      showBenchmark: { type: 'boolean', title: 'Overlay Nifty 50 drawdown' },
      thresholdPct: {
        type: 'integer',
        title: 'Review threshold (%)',
        description: 'Draws a reference line at this drawdown depth.',
        minimum: 5,
        maximum: 50,
      },
    },
  },
  defaultConfig: { range: '5Y', showBenchmark: true, thresholdPct: 20 },
  component: lazy(() => import('./index')),
  icon: IconAreaChart,
  dataSource: {
    endpoint: 'portfolio/nav-history',
    refreshInterval: env.VITE_DATA_REFRESH_INTERVAL,
    latencyProfile: 'high',
  },
};

export function summarizeDrawdown(data: DrawdownData, config: DrawdownConfig): string {
  const m = buildDrawdown(data, config);
  const when =
    m.peakDate && m.troughDate
      ? ` from ${formatDateKey(m.peakDate)} to ${formatDateKey(m.troughDate)}`
      : '';
  const recovered = m.recoveryDate
    ? `, recovered by ${formatDateKey(m.recoveryDate)}`
    : ', not yet recovered';
  return `Worst drawdown over ${config.range}: ${formatPct(m.maxDepth, 1, false)}${when}${m.troughDate ? recovered : ''}. Currently ${formatPct(m.current, 1, false)} below peak.`;
}

export const drawdownWidget = defineWidget(drawdownDefinition, {
  configParser: DrawdownConfigSchema,
  isData: isEndpointData('portfolio/nav-history'),
  isEmpty: (d) => d.points.length < 2,
  summarize: summarizeDrawdown,
  skeleton: 'area-chart',
  preload: () => import('./index'),
});
