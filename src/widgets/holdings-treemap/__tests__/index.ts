import { parseEndpoint } from '@/data/api';
import { fixture } from '@/__tests__/fixtures';
import type { HoldingsTreemapConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('portfolio/holdings');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: HoldingsTreemapConfig = {
  groupBy: 'none',
  colorBy: 'unrealised',
  capPct: 20,
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('portfolio/holdings');
  return parseEndpoint('portfolio/holdings', { ...base, holdings: [] });
};
