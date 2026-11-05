import { z } from 'zod';
import type { MarketTickerData } from '@/data/schemas';

export const TICKER_SYMBOLS = [
  'NIFTY50',
  'SENSEX',
  'SPX',
  'FTSE',
  'USDINR',
  'EURUSD',
  'GOLD',
  'CRUDE',
] as const;
export type TickerSymbol = (typeof TICKER_SYMBOLS)[number];

export const MarketTickerConfigSchema = z.object({
  showNIFTY50: z.boolean(),
  showSENSEX: z.boolean(),
  showSPX: z.boolean(),
  showFTSE: z.boolean(),
  showUSDINR: z.boolean(),
  showEURUSD: z.boolean(),
  showGOLD: z.boolean(),
  showCRUDE: z.boolean(),
  speed: z.enum(['slow', 'normal', 'fast']),
});

export type MarketTickerConfig = z.infer<typeof MarketTickerConfigSchema>;
export type MarketTickerWidgetData = MarketTickerData;
export type TickerQuote = MarketTickerData['quotes'][number];
