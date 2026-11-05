import { parseEndpoint } from '@/data/api';
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

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('research/feed');
  return parseEndpoint('research/feed', { ...base, articles: [] });
};
