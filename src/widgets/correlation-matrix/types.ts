import { z } from 'zod';
import type { ReturnSeriesData } from '@/data/schemas';

export const LOOKBACKS = ['30', '60', '90', '252'] as const;
export type Lookback = (typeof LOOKBACKS)[number];

export const CorrelationMatrixConfigSchema = z.object({
  /** Largest holdings by weight, or equity sectors. */
  subject: z.enum(['holdings', 'sectors']),
  count: z.enum(['10', '15']),
  /** Trading days of returns the correlations use. */
  lookback: z.enum(LOOKBACKS),
});

export type CorrelationMatrixConfig = z.infer<typeof CorrelationMatrixConfigSchema>;
export type CorrelationMatrixData = ReturnSeriesData;
export type ReturnSeries = ReturnSeriesData['holdings'][number];

/** The pair behind a clicked cell. */
export interface CellPair {
  row: number;
  col: number;
}
