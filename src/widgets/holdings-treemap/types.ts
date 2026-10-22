import { z } from 'zod';
import type { HoldingsData } from '@/data/schemas';
import type { Holding } from '@/types';

export const HoldingsTreemapConfigSchema = z.object({
  groupBy: z.enum(['sector', 'none']),
  colorBy: z.enum(['dayChange', 'unrealised']),
  capPct: z.number().min(0.5).max(50),
});

export type HoldingsTreemapConfig = z.infer<typeof HoldingsTreemapConfigSchema>;
export type HoldingsTreemapData = HoldingsData;

export interface TreeDatum {
  name: string;
  holding?: Holding;
  children?: TreeDatum[];
}
