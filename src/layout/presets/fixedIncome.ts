import type { WorkspacePreset } from './types';

/**
 * One dominant performance chart with panels beside it. The simulated dataset has no bond
 * yields or durations, so those two panels are labelled empty slots, not invented numbers.
 */
export const fixedIncome: WorkspacePreset = {
  id: 'fixed-income',
  name: 'Fixed Income',
  audience: 'Fixed income managers',
  description:
    'A large performance chart with benchmark comparison and alerts. Yield and duration panels are placeholders.',
  density: 'comfortable',
  widgets: [
    {
      widgetId: 'performance-line-chart',
      x: 0,
      y: 0,
      w: 9,
      h: 8,
      title: 'Fund vs Benchmarks',
      config: {
        range: '1Y',
        showSensex: true,
        showSpx: false,
        showCustom: true,
        customNiftyPct: 40,
      },
    },
    { widgetId: 'alert-panel', x: 9, y: 0, w: 3, h: 8, title: 'Alerts' },
    {
      widgetId: '__placeholder',
      x: 0,
      y: 8,
      w: 6,
      h: 4,
      title: 'Yield curve (placeholder)',
      config: { note: 'Not available: the simulated dataset has no bond yields.' },
    },
    {
      widgetId: '__placeholder',
      x: 6,
      y: 8,
      w: 6,
      h: 4,
      title: 'Duration & DV01 (placeholder)',
      config: { note: 'Not available: the simulated dataset has no bond durations.' },
    },
  ],
};
