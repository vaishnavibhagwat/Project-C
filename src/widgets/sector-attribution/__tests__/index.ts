import { fixture } from '@/__tests__/fixtures';
import type { SectorAttributionConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('performance/attribution');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: SectorAttributionConfig = {
  period: '1Y',
  effect: 'total',
  showTable: true,
};
