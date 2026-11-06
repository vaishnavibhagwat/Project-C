import { parseEndpoint } from '@/data/api';
import { fixture } from '@/__tests__/fixtures';
import type { TopMoversConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('portfolio/holdings');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: TopMoversConfig = { count: '3', rankBy: 'value' };

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () =>
  parseEndpoint('portfolio/holdings', { ...fixture('portfolio/holdings'), holdings: [] });
