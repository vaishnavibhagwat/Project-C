import type { WorkspacePreset } from './types';

/** Three columns with the performance chart large in the centre. */
export const portfolioManager: WorkspacePreset = {
  id: 'portfolio-manager',
  name: 'Portfolio Manager',
  audience: 'Day-to-day portfolio management',
  description:
    'Allocation and sector moves either side of a large performance chart, with holdings and news below.',
  density: 'comfortable',
  widgets: [
    {
      widgetId: 'portfolio-pie-chart',
      x: 0,
      y: 0,
      w: 3,
      h: 6,
      title: 'Sector Allocation',
      config: { grouping: 'sector' },
    },
    {
      widgetId: 'performance-line-chart',
      x: 3,
      y: 0,
      w: 6,
      h: 6,
      title: 'Performance vs Benchmarks',
      config: { range: '6M' },
    },
    {
      widgetId: 'sector-heat-map',
      x: 9,
      y: 0,
      w: 3,
      h: 6,
      title: 'Sector Heat Map',
      config: { capPct: 3 },
    },
    {
      widgetId: 'holdings-table',
      x: 0,
      y: 6,
      w: 8,
      h: 7,
      title: 'Holdings',
      config: { hiddenColumns: '' },
    },
    { widgetId: 'news-feed', x: 8, y: 6, w: 4, h: 7, title: 'News', config: { limit: '20' } },
  ],
};
