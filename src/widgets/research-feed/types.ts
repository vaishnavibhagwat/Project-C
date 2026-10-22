import { z } from 'zod';
import type { ResearchData } from '@/data/schemas';
import type { NewsArticle } from '@/types';

export const SENTIMENT_FILTERS = ['all', 'positive', 'neutral', 'negative'] as const;
export const CATEGORY_FILTERS = ['all', 'earnings', 'macro', 'sector', 'rating', 'flows'] as const;

export const ResearchFeedConfigSchema = z.object({
  sentiment: z.enum(SENTIMENT_FILTERS),
  category: z.enum(CATEGORY_FILTERS),
  showSummary: z.boolean(),
});

export type ResearchFeedConfig = z.infer<typeof ResearchFeedConfigSchema>;
export type ResearchFeedData = ResearchData;
export type { NewsArticle };
