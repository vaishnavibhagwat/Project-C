import { parseEndpoint } from '@/data/api';
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

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('portfolio/allocation');
  return parseEndpoint('portfolio/allocation', {
    ...base,
    assetClasses: [],
    geographies: [],
    sectors: [],
  });
};
