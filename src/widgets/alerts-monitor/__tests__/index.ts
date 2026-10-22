import { fixture } from '@/__tests__/fixtures';
import type { AlertsMonitorConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('alerts/active');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: AlertsMonitorConfig = {
  minSeverity: 'warning',
  type: 'all',
  showAcknowledged: false,
};
