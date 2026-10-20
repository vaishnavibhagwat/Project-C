import { z } from 'zod';
import type { VarData } from '@/data/schemas';

export const VarGaugeConfigSchema = z.object({
  confidence: z.enum(['95', '99']),
  method: z.enum(['historical', 'parametric']),
  limitPct: z.number().min(0.5).max(5),
  currency: z.enum(['INR', 'USD']),
  showHistogram: z.boolean(),
});

export type VarGaugeConfig = z.infer<typeof VarGaugeConfigSchema>;
export type VarGaugeData = VarData;
