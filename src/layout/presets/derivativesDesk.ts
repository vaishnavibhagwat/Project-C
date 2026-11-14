import type { WorkspacePreset } from './types';

/** Dense: four panels on one screen in compact density (ticker over three tight columns). */
export const derivativesDesk: WorkspacePreset = {
  id: 'derivatives-desk',
  name: 'Derivatives Desk',
  audience: 'Traders',
  description:
    'A compact desk: fast ticker over alerts, positions and factor attribution, side by side.',
  density: 'compact',
  widgets: [
    {
      widgetId: 'market-ticker',
      x: 0,
      y: 0,
      w: 12,
      h: 1,
      title: 'Ticker',
      config: { speed: 'fast' },
    },
    { widgetId: 'alert-panel', x: 0, y: 1, w: 3, h: 7, title: 'Alerts' },
    {
      widgetId: 'holdings-table',
      x: 3,
      y: 1,
      w: 5,
      h: 7,
      title: 'Positions',
      config: { pageSize: '25' },
    },
    {
      widgetId: 'attribution-bar-chart',
      x: 8,
      y: 1,
      w: 4,
      h: 7,
      title: 'Attribution (factor)',
      config: { grouping: 'factor', layout: 'grouped' },
    },
  ],
};
