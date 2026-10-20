import { z } from 'zod';
import type { SectorReturnsData } from '@/data/schemas';

export const SectorHeatmapConfigSchema = z.object({
  days: z.enum(['5', '10', '20']),
  sortBy: z.enum(['weight', 'name', 'latest']),
  showValues: z.boolean(),
  capPct: z.number().min(0.5).max(5),
});

export type SectorHeatmapConfig = z.infer<typeof SectorHeatmapConfigSchema>;
export type SectorHeatmapData = SectorReturnsData;
