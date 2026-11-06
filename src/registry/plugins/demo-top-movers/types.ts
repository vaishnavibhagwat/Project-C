import { z } from 'zod';
import type { HoldingsData } from '@/data/schemas';

export const MOVER_COUNTS = ['3', '5', '8'] as const;

export const TopMoversConfigSchema = z.object({
  /** Rows in each list (gainers and losers). */
  count: z.enum(MOVER_COUNTS),
  /** Rank by the day's percentage move or by the day's P&L in rupees. */
  rankBy: z.enum(['percent', 'value']),
});

export type TopMoversConfig = z.infer<typeof TopMoversConfigSchema>;
export type TopMoversData = HoldingsData;
export type Mover = HoldingsData['holdings'][number];
