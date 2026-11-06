import { z } from 'zod';
import type { NavHistoryData } from '@/data/schemas';

export const VOL_WINDOWS = ['21', '63', '126'] as const;
export const VOL_RANGES = ['1Y', '3Y', '5Y'] as const;
export type VolRange = (typeof VOL_RANGES)[number];

export const VolatilityHistoryConfigSchema = z.object({
  /** Rolling window in trading days (about 1, 3 or 6 months). */
  window: z.enum(VOL_WINDOWS),
  range: z.enum(VOL_RANGES),
  showBenchmark: z.boolean(),
});

export type VolatilityHistoryConfig = z.infer<typeof VolatilityHistoryConfigSchema>;
export type VolatilityHistoryData = NavHistoryData;

export interface VolPoint {
  date: string;
  /** Annualised volatility, percent. */
  fund: number;
  benchmark: number;
}
