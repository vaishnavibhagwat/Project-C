import { z } from 'zod';
import type { ResearchData, ResearchItem } from '@/data/schemas';

export const ResearchFeedConfigSchema = z.object({
  sentiment: z.enum(['ALL', 'Positive', 'Neutral', 'Negative']),
  category: z.enum(['ALL', 'Earnings', 'Macro', 'Sector', 'Rating', 'Flows']),
  showSummary: z.boolean(),
});

export type ResearchFeedConfig = z.infer<typeof ResearchFeedConfigSchema>;
export type ResearchFeedData = ResearchData;
export type { ResearchItem };
