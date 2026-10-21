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
