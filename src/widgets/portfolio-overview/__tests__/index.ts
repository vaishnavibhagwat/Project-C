import { parseEndpoint } from '@/data/api';
import { fixture } from '@/__tests__/fixtures';
import type { PortfolioOverviewConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('portfolio/summary');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: PortfolioOverviewConfig = {
  currency: 'USD',
  showReturns: false,
  showBenchmark: true,
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('portfolio/summary');
  return parseEndpoint('portfolio/summary', { ...base, holdingsCount: 0 });
};
