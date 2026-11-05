import { parseEndpoint } from '@/data/api';
import { fixture } from '@/__tests__/fixtures';
import type { DrawdownConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('portfolio/nav-history');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: DrawdownConfig = {
  range: '1Y',
  showBenchmark: false,
  thresholdPct: 10,
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('portfolio/nav-history');
  return parseEndpoint('portfolio/nav-history', { ...base, points: base.points.slice(0, 1) });
};
