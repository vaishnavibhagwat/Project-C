import { fixture } from '@/__tests__/fixtures';
import type { AssetAllocationConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('portfolio/allocation');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: AssetAllocationConfig = {
  view: 'sector',
  currency: 'USD',
  showLegend: true,
};
