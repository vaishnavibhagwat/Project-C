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
