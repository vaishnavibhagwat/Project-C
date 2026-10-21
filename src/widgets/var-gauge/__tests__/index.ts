import { fixture } from '@/__tests__/fixtures';
import type { VarGaugeConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('risk/var');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: VarGaugeConfig = {
  confidence: '95',
  method: 'parametric',
  limitPct: 1,
  currency: 'USD',
  showHistogram: true,
};
