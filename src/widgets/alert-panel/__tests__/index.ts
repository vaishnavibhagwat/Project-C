import { fixture } from '@/__tests__/fixtures';
import { parseEndpoint } from '@/data/api';
import type { AlertPanelConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded portfolio model). */
export const fixtureData = () => fixture('alerts/panel');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: AlertPanelConfig = {
  rules: JSON.stringify([
    { id: 'rel-up', kind: 'price-above', ticker: 'RELIANCE', threshold: 1, severity: 'critical' },
    { id: 'var95', kind: 'var-above', confidence: '95', limitPct: 0.5, severity: 'info' },
  ]),
  dismissed: '',
  snoozes: '{}',
  minSeverity: 'warning',
  pulseCritical: false,
};

/** A valid response with no alerts and calm inputs: no default rule fires. */
export const emptyData = () => {
  const base = fixture('alerts/panel');
  return parseEndpoint('alerts/panel', {
    ...base,
    alerts: [],
    inputs: { ...base.inputs, var95: 0.001, var99: 0.002, currentDrawdown: 0 },
  });
};
