import { fixture } from '@/__tests__/fixtures';
import { parseEndpoint } from '@/data/api';
import type { SectorHeatMapConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded portfolio model). */
export const fixtureData = () => fixture('portfolio/holdings');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: SectorHeatMapConfig = {
  colorScale: 'blue-orange',
  capPct: 1,
  scope: 'all',
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('portfolio/holdings');
  return parseEndpoint('portfolio/holdings', { ...base, holdings: [] });
};
