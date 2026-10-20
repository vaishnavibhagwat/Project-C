import { z } from 'zod';
import type { NavHistoryData } from '@/data/schemas';

export const NAV_RANGES = ['1M', '3M', '6M', '1Y', '3Y', '5Y'] as const;
export type NavRange = (typeof NAV_RANGES)[number];

export const RANGE_DAYS: Record<NavRange, number> = {
  '1M': 21,
  '3M': 63,
  '6M': 126,
  '1Y': 252,
  '3Y': 756,
  '5Y': 1260,
};

export const NavPerformanceConfigSchema = z.object({
  range: z.enum(NAV_RANGES),
  showBenchmark: z.boolean(),
  mode: z.enum(['rebased', 'nav']),
});

export type NavPerformanceConfig = z.infer<typeof NavPerformanceConfigSchema>;
export type NavPerformanceData = NavHistoryData;

export interface NavChartPoint {
  date: string;
  portfolio: number;
  benchmark: number;
}
