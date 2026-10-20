import { z } from 'zod';
import type { SummaryData } from '@/data/schemas';

export const PortfolioOverviewConfigSchema = z.object({
  currency: z.enum(['INR', 'USD']),
  showReturns: z.boolean(),
  showBenchmark: z.boolean(),
});

export type PortfolioOverviewConfig = z.infer<typeof PortfolioOverviewConfigSchema>;
export type PortfolioOverviewData = SummaryData;
