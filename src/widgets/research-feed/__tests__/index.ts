import { fixture } from '@/__tests__/fixtures';
import type { ResearchFeedConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('research/feed');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: ResearchFeedConfig = {
  sentiment: 'positive',
  category: 'all',
  showSummary: false,
};
