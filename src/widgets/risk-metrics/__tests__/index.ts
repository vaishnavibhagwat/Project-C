import { parseEndpoint } from '@/data/api';
import { fixture } from '@/__tests__/fixtures';
import type { RiskMetricsConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('risk/metrics');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: RiskMetricsConfig = { period: '1Y', showDefinitions: false };

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('risk/metrics');
  return parseEndpoint('risk/metrics', { ...base, observations: 0 });
};
