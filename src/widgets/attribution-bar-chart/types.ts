import { z } from 'zod';
import type { AttributionInputsData } from '@/data/schemas';

export const GROUPINGS = ['sector', 'factor', 'asset-class'] as const;
export type Grouping = (typeof GROUPINGS)[number];
export const FIXED_PERIODS = ['mtd', 'prev', 'yoy'] as const;
export type FixedPeriod = (typeof FIXED_PERIODS)[number];
/** The three calendar periods, plus a range received with DATE_RANGE_CHANGED. */
export type PeriodKey = FixedPeriod | 'range';

export const AttributionBarChartConfigSchema = z.object({
  grouping: z.enum(GROUPINGS),
  layout: z.enum(['stacked', 'grouped']),
  /** Absolute: basis points of return. Relative: share of the period's active return, %. */
  unit: z.enum(['bps', 'pct']),
  /** Show the periods side by side instead of one period. */
  compare: z.boolean(),
  period: z.enum(FIXED_PERIODS),
});

export type AttributionBarChartConfig = z.infer<typeof AttributionBarChartConfigSchema>;
export type AttributionBarChartData = AttributionInputsData;
export type InputPosition = AttributionInputsData['positions'][number];

/** A span of trading days (indices into the dates, start = the close the period starts from). */
export interface PeriodWindow {
  key: PeriodKey;
  label: string;
  start: number;
  end: number;
  from: string;
  to: string;
}

export interface SegmentAttribution {
  key: string;
  label: string;
  portfolioWeight: number;
  benchmarkWeight: number;
  portfolioReturn: number;
  benchmarkReturn: number;
  allocation: number;
  selection: number;
  interaction: number;
  total: number;
}

export interface WindowAttribution {
  window: PeriodWindow;
  segments: SegmentAttribution[];
  allocation: number;
  selection: number;
  interaction: number;
  /** Portfolio minus benchmark return of the sleeve over the window. */
  active: number;
  portfolioReturn: number;
  benchmarkReturn: number;
}

export interface HoldingContribution {
  key: string;
  label: string;
  name: string;
  /** Weight in the sleeve at the start of the window. */
  weight: number;
  return: number;
  /** weight × (return − the segment's benchmark return): sums to selection + interaction. */
  contribution: number;
}
