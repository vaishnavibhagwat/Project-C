import { fixture } from '@/__tests__/fixtures';
import { parseEndpoint } from '@/data/api';
import type { RiskContributionConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded portfolio model). */
export const fixtureData = () => fixture('risk/contributions');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: RiskContributionConfig = {
  top: '10',
  confidence: '95',
  horizonDays: '10',
  measure: 'share',
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('risk/contributions');
  return parseEndpoint('risk/contributions', { ...base, positions: [] });
};
