import { parseEndpoint } from '@/data/api';
import { fixture } from '@/__tests__/fixtures';
import type { NavPerformanceConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('portfolio/nav-history');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: NavPerformanceConfig = {
  range: '5Y',
  showBenchmark: false,
  mode: 'nav',
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('portfolio/nav-history');
  return parseEndpoint('portfolio/nav-history', { ...base, points: base.points.slice(0, 1) });
};
