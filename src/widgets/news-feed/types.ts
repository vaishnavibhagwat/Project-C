import { z } from 'zod';
import { NEWS_SOURCES } from '@/data/constants';
import type { MarketNewsData } from '@/data/schemas';

export const NEWS_SOURCE_FILTERS = ['all', ...NEWS_SOURCES] as const;
export type NewsSourceFilter = (typeof NEWS_SOURCE_FILTERS)[number];
export const NEWS_LIMITS = ['20', '40', '80'] as const;

export const NewsFeedConfigSchema = z.object({
  /** Words that must all appear in the headline, summary, tickers or source. */
  keyword: z.string().max(60),
  source: z.enum(NEWS_SOURCE_FILTERS),
  limit: z.enum(NEWS_LIMITS),
});

export type NewsFeedConfig = z.infer<typeof NewsFeedConfigSchema>;
export type NewsFeedData = MarketNewsData;
export type FeedArticle = NewsFeedData['articles'][number];
