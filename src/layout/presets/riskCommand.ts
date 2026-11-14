import type { WorkspacePreset } from './types';

/** Two tall columns: risk measures on the left, what moves them on the right. */
export const riskCommand: WorkspacePreset = {
  id: 'risk-command',
  name: 'Risk Command',
  audience: 'Risk managers',
  description:
    'VaR and correlations beside live alerts and the sector heat map, in two tall columns.',
  density: 'comfortable',
  widgets: [
    {
      widgetId: 'var-gauge',
      x: 0,
      y: 0,
      w: 6,
      h: 6,
      title: 'Value at Risk (95%, parametric)',
      config: { confidence: '95', method: 'parametric' },
    },
    {
      widgetId: 'alert-panel',
      x: 6,
      y: 0,
      w: 6,
      h: 6,
      title: 'Risk Alerts',
      config: { minSeverity: 'warning' },
    },
    {
      widgetId: 'correlation-matrix',
      x: 0,
      y: 6,
      w: 6,
      h: 8,
      title: 'Correlation (sectors, 1 year)',
      config: { subject: 'sectors', lookback: '252' },
    },
    {
      widgetId: 'sector-heat-map',
      x: 6,
      y: 6,
      w: 6,
      h: 8,
      title: 'Sector Heat Map',
      config: { colorScale: 'blue-orange', scope: 'all' },
    },
  ],
};
