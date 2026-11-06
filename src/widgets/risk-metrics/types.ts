import { z } from 'zod';
import type { MetricsData } from '@/data/schemas';

export const RiskMetricsConfigSchema = z.object({
  period: z.enum(['full', '1Y']),
  showDefinitions: z.boolean(),
  /** Tiles, or a metrics table (metric, value, detail, definition). */
  layout: z.enum(['tiles', 'table']),
});

export type RiskMetricsConfig = z.infer<typeof RiskMetricsConfigSchema>;
export type RiskMetricsData = MetricsData;

export interface MetricTile {
  key: string;
  label: string;
  value: string;
  /** Sign used for direction cues; null for neutral metrics. */
  tone: 'good' | 'bad' | 'neutral';
  detail?: string;
  definition: string;
}
