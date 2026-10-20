import { z } from 'zod';
import type { AllocationData } from '@/data/schemas';

export const AssetAllocationConfigSchema = z.object({
  view: z.enum(['asset-class', 'sector']),
  currency: z.enum(['INR', 'USD']),
  showLegend: z.boolean(),
});

export type AssetAllocationConfig = z.infer<typeof AssetAllocationConfigSchema>;
export type AssetAllocationData = AllocationData;

export interface Slice {
  key: string;
  label: string;
  valueInr: number;
  weightPct: number;
}
