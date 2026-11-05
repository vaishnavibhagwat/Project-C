import { lazy } from 'react';
import { IconLineChart } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { describeWindow, presetWindow, selectedSeries } from './model';
import {
  PerformanceLineChartConfigSchema,
  type PerformanceLineChartConfig,
  type PerformanceLineChartData,
} from './types';

/** Brief: refresh every 60 s (end-of-day series; the last point moves only after the close). */
export const PERFORMANCE_LINE_REFRESH_MS = 60_000;

const benchmarkToggle = (title: string) => ({ type: 'boolean' as const, title });

export const performanceLineChartDefinition: WidgetDefinition<
  PerformanceLineChartConfig,
  PerformanceLineChartData
> = {
  id: 'performance-line-chart',
  name: 'Performance vs Benchmarks',
  description:
    'Fund NAV against Nifty 50, Sensex, S&P 500, sector indices and a custom blend, rebased to 100. Drag to zoom, scroll to pan.',
  category: WidgetCategory.CHART,
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 4, h: 3 },
  maxSize: { w: 12, h: 8 },
  configSchema: {
    type: 'object',
    properties: {
      range: {
        title: 'Date range',
        oneOf: ['1W', '1M', '3M', '6M', '1Y', 'YTD', 'MAX'].map((r) => ({ const: r, title: r })),
      },
      logScale: { type: 'boolean', title: 'Logarithmic scale' },
      showNifty50: benchmarkToggle('Nifty 50'),
      showSensex: benchmarkToggle('BSE Sensex'),
      showSpx: benchmarkToggle('S&P 500'),
      showNiftyBank: benchmarkToggle('Nifty Bank'),
      showNiftyIt: benchmarkToggle('Nifty IT'),
      showNiftyPharma: benchmarkToggle('Nifty Pharma'),
      showCustom: benchmarkToggle('Custom blend'),
      customNiftyPct: {
        type: 'integer',
        title: 'Custom blend: Nifty 50 share (%)',
        description: 'The rest is S&P 500. Rebalanced daily.',
        minimum: 0,
        maximum: 100,
      },
      fundColor: {
        title: 'Fund line colour',
        oneOf: [
          { const: 'accent', title: 'Accent' },
          ...[1, 2, 3, 4, 5, 6].map((n) => ({ const: `chart${n}`, title: `Series ${n}` })),
        ],
      },
      benchmarkColors: {
        title: 'Benchmark line colours',
        oneOf: [
          { const: 'series', title: 'Theme series colours' },
          { const: 'muted', title: 'Muted, with dash patterns' },
        ],
      },
    },
  },
  defaultConfig: {
    range: '1Y',
    logScale: false,
    showNifty50: true,
    showSensex: false,
    showSpx: true,
    showNiftyBank: false,
    showNiftyIt: false,
    showNiftyPharma: false,
    showCustom: false,
    customNiftyPct: 60,
    fundColor: 'accent',
    benchmarkColors: 'series',
  },
  component: lazy(() => import('./index')),
  icon: IconLineChart,
  dataSource: {
    endpoint: 'performance/benchmarks',
    refreshInterval: PERFORMANCE_LINE_REFRESH_MS,
    latencyProfile: 'high',
  },
};

export function summarizePerformanceLine(
  data: PerformanceLineChartData,
  config: PerformanceLineChartConfig,
): string {
  return describeWindow(
    data.dates,
    selectedSeries(data, config),
    presetWindow(data.dates, config.range),
  );
}

export const performanceLineChartWidget = defineWidget(performanceLineChartDefinition, {
  configParser: PerformanceLineChartConfigSchema,
  isData: isEndpointData('performance/benchmarks'),
  isEmpty: (d) => d.dates.length < 2,
  summarize: summarizePerformanceLine,
  skeleton: 'line-chart',
  preload: () => import('./index'),
});
