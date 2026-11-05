import { fixture } from '@/__tests__/fixtures';
import { parseEndpoint } from '@/data/api';
import type { NewsFeedConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded portfolio model). */
export const fixtureData = () => fixture('market/news');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: NewsFeedConfig = {
  keyword: 'shares',
  source: 'Reuters',
  limit: '20',
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('market/news');
  return parseEndpoint('market/news', { ...base, articles: [] });
};
