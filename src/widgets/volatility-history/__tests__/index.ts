import { fixture } from '@/__tests__/fixtures';
import { parseEndpoint } from '@/data/api';
import type { VolatilityHistoryConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded portfolio model). */
export const fixtureData = () => fixture('portfolio/nav-history');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: VolatilityHistoryConfig = {
  window: '21',
  range: '1Y',
  showBenchmark: false,
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('portfolio/nav-history');
  return parseEndpoint('portfolio/nav-history', { ...base, points: base.points.slice(0, 1) });
};
