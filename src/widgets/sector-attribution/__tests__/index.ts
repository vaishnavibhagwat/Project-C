import { parseEndpoint } from '@/data/api';
import { fixture } from '@/__tests__/fixtures';
import type { SectorAttributionConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('performance/attribution');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: SectorAttributionConfig = {
  period: '1Y',
  effect: 'total',
  showTable: true,
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('performance/attribution');
  return parseEndpoint('performance/attribution', { ...base, periods: [] });
};
