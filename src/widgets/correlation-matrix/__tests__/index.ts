import { fixture } from '@/__tests__/fixtures';
import { parseEndpoint } from '@/data/api';
import type { CorrelationMatrixConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded portfolio model). */
export const fixtureData = () => fixture('risk/returns');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: CorrelationMatrixConfig = {
  subject: 'sectors',
  count: '15',
  lookback: '252',
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('risk/returns');
  return parseEndpoint('risk/returns', { ...base, dates: [], holdings: [], sectors: [] });
};
