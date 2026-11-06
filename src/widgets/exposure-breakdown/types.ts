import { z } from 'zod';
import type { ExposureData } from '@/data/schemas';

export const EXPOSURE_DIMENSIONS = ['asset-class', 'sector', 'geography', 'currency'] as const;
export type ExposureDimension = (typeof EXPOSURE_DIMENSIONS)[number];

export const ExposureBreakdownConfigSchema = z.object({
  dimension: z.enum(EXPOSURE_DIMENSIONS),
  /** Show market value beside economic exposure. */
  showMarketValue: z.boolean(),
});

export type ExposureBreakdownConfig = z.infer<typeof ExposureBreakdownConfigSchema>;
export type ExposureBreakdownData = ExposureData;

export interface ExposureRow {
  key: string;
  /** Percent of the book's market value (NAV). */
  marketValuePct: number;
  exposurePct: number;
}
