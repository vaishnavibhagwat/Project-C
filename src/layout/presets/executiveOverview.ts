import type { WorkspacePreset } from './types';

/** Large aggregates for a CIO or client review: few widgets, big numbers. */
export const executiveOverview: WorkspacePreset = {
  id: 'executive-overview',
  name: 'Executive Overview',
  audience: 'CIO, client reviews',
  description: 'Summary strip, performance against benchmarks, attribution and VaR at a glance.',
  density: 'comfortable',
  widgets: [
    { widgetId: 'market-ticker', x: 0, y: 0, w: 12, h: 1, title: 'Markets' },
    {
      widgetId: 'portfolio-overview',
      x: 0,
      y: 1,
      w: 12,
      h: 2,
      title: 'Fund Summary',
      config: { showBenchmark: true, showReturns: true },
    },
    {
      widgetId: 'performance-line-chart',
      x: 0,
      y: 3,
      w: 8,
      h: 6,
      title: 'Performance vs Benchmarks',
      config: { range: 'YTD', showSensex: true },
    },
    {
      widgetId: 'var-gauge',
      x: 8,
      y: 3,
      w: 4,
      h: 6,
      title: 'Value at Risk',
      config: { showHistogram: false },
    },
    {
      widgetId: 'attribution-bar-chart',
      x: 0,
      y: 9,
      w: 12,
      h: 5,
      title: 'Attribution by Asset Class',
      config: { grouping: 'asset-class', unit: 'pct' },
    },
  ],
};
