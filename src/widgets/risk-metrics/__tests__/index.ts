import { fixture } from '@/__tests__/fixtures';
import type { RiskMetricsConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('risk/metrics');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: RiskMetricsConfig = { period: '1Y', showDefinitions: false };
