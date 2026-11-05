import { parseEndpoint } from '@/data/api';
import { fixture } from '@/__tests__/fixtures';
import type { VarGaugeConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('risk/var');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: VarGaugeConfig = {
  confidence: '95',
  method: 'parametric',
  limitPct: 1,
  currency: 'USD',
  showHistogram: true,
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('risk/var');
  return parseEndpoint('risk/var', { ...base, lookbackDays: 0, histogram: [], history: [] });
};
