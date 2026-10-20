import { z } from 'zod';
import type { Trade, TradesData } from '@/data/schemas';

export const TradeBlotterConfigSchema = z.object({
  side: z.enum(['ALL', 'BUY', 'SELL']),
  status: z.enum(['ALL', 'Filled', 'Settling', 'Settled']),
  showSettlement: z.boolean(),
});

export type TradeBlotterConfig = z.infer<typeof TradeBlotterConfigSchema>;
export type TradeBlotterData = TradesData;
export type { Trade };
