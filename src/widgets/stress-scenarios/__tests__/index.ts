import { fixture } from '@/__tests__/fixtures';
import { parseEndpoint } from '@/data/api';
import type { StressScenariosConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded portfolio model). */
export const fixtureData = () => fixture('risk/stress');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: StressScenariosConfig = { currency: 'USD', showDetail: false };

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('risk/stress');
  return parseEndpoint('risk/stress', { ...base, scenarios: [] });
};
