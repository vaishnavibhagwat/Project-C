import { z } from 'zod';
import type { PerformanceSeriesData } from '@/data/schemas';

export const PERF_PRESETS = ['1W', '1M', '3M', '6M', '1Y', 'YTD', 'MAX'] as const;
export type PerfPreset = (typeof PERF_PRESETS)[number];

/** Theme tokens offered for the fund's line. */
export const FUND_COLORS = [
  'accent',
  'chart1',
  'chart2',
  'chart3',
  'chart4',
  'chart5',
  'chart6',
] as const;
export type FundColor = (typeof FUND_COLORS)[number];

/** Benchmarks in theme series colours, or muted with distinct dash patterns. */
export const BENCHMARK_COLOR_MODES = ['series', 'muted'] as const;

export const PerformanceLineChartConfigSchema = z.object({
  range: z.enum(PERF_PRESETS),
  logScale: z.boolean(),
  showNifty50: z.boolean(),
  showSensex: z.boolean(),
  showSpx: z.boolean(),
  showNiftyBank: z.boolean(),
  showNiftyIt: z.boolean(),
  showNiftyPharma: z.boolean(),
  showCustom: z.boolean(),
  /** Custom benchmark: this share in the Nifty 50, the rest in the S&P 500, rebalanced daily. */
  customNiftyPct: z.number().int().min(0).max(100),
  fundColor: z.enum(FUND_COLORS),
  benchmarkColors: z.enum(BENCHMARK_COLOR_MODES),
});

export type PerformanceLineChartConfig = z.infer<typeof PerformanceLineChartConfigSchema>;
export type PerformanceLineChartData = PerformanceSeriesData;
export type BenchmarkKey = PerformanceSeriesData['benchmarks'][number]['id'];

/** One line on the chart. `FUND` is the portfolio NAV; `CUSTOM` the blended benchmark. */
export type SeriesKey = 'FUND' | BenchmarkKey | 'CUSTOM';

export interface ChartSeries {
  key: SeriesKey;
  name: string;
  /** Short legend label. */
  short: string;
  /** Levels in the series' own units, one per date. */
  levels: readonly number[];
}

/** Visible range as inclusive indices into the dates. */
export interface DateWindow {
  start: number;
  end: number;
}

/** One chart row: the date plus every series rebased to 100 at the window start. */
export type ChartRow = { date: string } & Partial<Record<SeriesKey, number>>;
