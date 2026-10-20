import { z } from 'zod';
import type { NavHistoryData } from '@/data/schemas';

export const DRAWDOWN_RANGES = ['1Y', '3Y', '5Y'] as const;
export type DrawdownRange = (typeof DRAWDOWN_RANGES)[number];

export const DrawdownConfigSchema = z.object({
  range: z.enum(DRAWDOWN_RANGES),
  showBenchmark: z.boolean(),
  thresholdPct: z.number().int().min(5).max(50),
});

export type DrawdownConfig = z.infer<typeof DrawdownConfigSchema>;
export type DrawdownData = NavHistoryData;

export interface DrawdownPoint {
  date: string;
  fund: number;
  benchmark: number;
}
