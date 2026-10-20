import { z } from 'zod';
import type { AttributionData } from '@/data/schemas';

export const ATTRIBUTION_PERIOD_OPTIONS = ['1M', '3M', '6M', '1Y'] as const;

export const SectorAttributionConfigSchema = z.object({
  period: z.enum(ATTRIBUTION_PERIOD_OPTIONS),
  effect: z.enum(['stacked', 'total', 'allocation', 'selection']),
  showTable: z.boolean(),
});

export type SectorAttributionConfig = z.infer<typeof SectorAttributionConfigSchema>;
export type SectorAttributionData = AttributionData;
