import { z } from 'zod';
import type { StressData } from '@/data/schemas';

export const StressScenariosConfigSchema = z.object({
  currency: z.enum(['INR', 'USD']),
  /** Show the largest contributors and the asset-class split under each scenario. */
  showDetail: z.boolean(),
});

export type StressScenariosConfig = z.infer<typeof StressScenariosConfigSchema>;
export type StressScenariosData = StressData;
export type Scenario = StressData['scenarios'][number];
