import { lazy } from 'react';
import { IconLineChart } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { registerWidget } from '@/registry/defineWidget';
import { env } from '@/utils/env';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { directionWord, formatPct } from '@/utils/format';
import { buildNavSeries } from './model';
import {
  NAV_RANGES,
  NavPerformanceConfigSchema,
  type NavPerformanceConfig,
  type NavPerformanceData,
} from './types';

export const navPerformanceDefinition: WidgetDefinition<NavPerformanceConfig, NavPerformanceData> =
  {
    id: 'nav-performance',
    name: 'NAV vs Nifty 50',
    description:
      'Fund NAV against the Nifty 50 (simulated total-return index), rebased to 100 at the start of the selected range.',
    category: WidgetCategory.CHART,
    defaultSize: { w: 6, h: 10 },
    minSize: { w: 3, h: 6 },
    configSchema: {
      type: 'object',
      properties: {
        range: {
          title: 'Range',
          oneOf: NAV_RANGES.map((r) => ({ const: r, title: r })),
        },
        mode: {
          title: 'Scale',
          oneOf: [
            { const: 'rebased', title: 'Rebased to 100' },
            { const: 'nav', title: 'NAV per unit (₹)' },
          ],
        },
        showBenchmark: { type: 'boolean', title: 'Show Nifty 50 benchmark' },
      },
    },
    defaultConfig: { range: '1Y', showBenchmark: true, mode: 'rebased' },
    component: lazy(() => import('./index')),
    icon: IconLineChart,
    dataSource: {
      endpoint: 'portfolio/nav-history',
      refreshIntervalMs: env.VITE_DATA_REFRESH_INTERVAL,
    },
  };

export function summarizeNav(data: NavPerformanceData, config: NavPerformanceConfig): string {
  const s = buildNavSeries(data, config);
  const active = s.portfolioReturn - s.benchmarkReturn;
  return (
    `Over ${config.range}, the fund is ${directionWord(s.portfolioReturn)} ${formatPct(s.portfolioReturn, 2, false)}; ` +
    `Nifty 50 is ${directionWord(s.benchmarkReturn)} ${formatPct(s.benchmarkReturn, 2, false)}. ` +
    `Active return ${formatPct(active)}.`
  );
}

export const navPerformanceWidget = registerWidget(navPerformanceDefinition, {
  configParser: NavPerformanceConfigSchema,
  isData: isEndpointData('portfolio/nav-history'),
  isEmpty: (d) => d.points.length < 2,
  summarize: summarizeNav,
  skeleton: 'line-chart',
  preload: () => import('./index'),
});
