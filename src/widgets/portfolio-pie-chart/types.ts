import { z } from 'zod';
import type { HoldingsData } from '@/data/schemas';

export const PIE_GROUPINGS = ['asset-class', 'sector', 'geography', 'custom'] as const;
export type PieGrouping = (typeof PIE_GROUPINGS)[number];

/** Fields offered by the "Custom" grouping. */
export const PIE_CUSTOM_FIELDS = ['instrument-type', 'currency'] as const;
export type PieCustomField = (typeof PIE_CUSTOM_FIELDS)[number];

export const PIE_CHART_TYPES = ['donut', 'pie'] as const;
export const PIE_PALETTES = ['theme', 'monochrome', 'soft'] as const;
export type PiePalette = (typeof PIE_PALETTES)[number];

export const PortfolioPieChartConfigSchema = z.object({
  grouping: z.enum(PIE_GROUPINGS),
  customField: z.enum(PIE_CUSTOM_FIELDS),
  chartType: z.enum(PIE_CHART_TYPES),
  showValueLabels: z.boolean(),
  palette: z.enum(PIE_PALETTES),
});

export type PortfolioPieChartConfig = z.infer<typeof PortfolioPieChartConfigSchema>;
export type PortfolioPieChartData = HoldingsData;
export type PieHolding = PortfolioPieChartData['holdings'][number];

/** A field holdings can be grouped by; `holding` is the last drill level (one slice each). */
export type Dimension =
  'asset-class' | 'sector' | 'geography' | 'instrument-type' | 'currency' | 'holding';

/** One click of a drill-down: the slice chosen at a level. */
export interface DrillStep {
  dimension: Dimension;
  key: string;
  label: string;
}

export interface PieSlice {
  key: string;
  label: string;
  valueInr: number;
  /** Share of this pie (the slices of a level sum to 100). */
  sharePct: number;
  /** Share of the whole book. */
  bookPct: number;
  /** Number of holdings in the slice. */
  count: number;
  /** Whether clicking opens a breakdown (false for single holdings and "Other"). */
  drillable: boolean;
  isOther: boolean;
}

/** What the pie shows at the current drill path. */
export interface PieLevel {
  dimension: Dimension;
  /** e.g. "Sector" — the dimension shown. */
  title: string;
  /** The drill path actually applied (steps whose slice no longer exists are dropped). */
  path: DrillStep[];
  slices: PieSlice[];
  totalInr: number;
  /** The level's total as a share of the whole book. */
  bookPct: number;
}
