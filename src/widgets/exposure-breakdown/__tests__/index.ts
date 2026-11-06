import { fixture } from '@/__tests__/fixtures';
import { parseEndpoint } from '@/data/api';
import type { ExposureBreakdownConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded portfolio model). */
export const fixtureData = () => fixture('risk/exposure');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: ExposureBreakdownConfig = {
  dimension: 'currency',
  showMarketValue: false,
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('risk/exposure');
  return parseEndpoint('risk/exposure', { ...base, positions: [] });
};
