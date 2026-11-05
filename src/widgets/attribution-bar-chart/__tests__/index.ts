import { fixture } from '@/__tests__/fixtures';
import { parseEndpoint } from '@/data/api';
import type { AttributionBarChartConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded portfolio model). */
export const fixtureData = () => fixture('performance/attribution-inputs');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: AttributionBarChartConfig = {
  grouping: 'asset-class',
  layout: 'grouped',
  unit: 'bps',
  compare: true,
  period: 'prev',
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('performance/attribution-inputs');
  return parseEndpoint('performance/attribution-inputs', {
    ...base,
    dates: [],
    positions: [],
    benchmark: [],
    policy: { ...base.policy, levels: { Equity: [], 'Fixed Income': [], Alternatives: [] } },
  });
};
