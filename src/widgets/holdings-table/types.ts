import { z } from 'zod';
import type { HoldingsData } from '@/data/schemas';
import type { Holding } from '@/types';

export const HOLDING_SORT_KEYS = [
  'ticker',
  'weight',
  'dailyPnLPercent',
  'marketValue',
  'dailyPnL',
  'unrealisedPnLPercent',
] as const;
export type HoldingSortKey = (typeof HOLDING_SORT_KEYS)[number];

export const SECTOR_FILTERS = [
  'All',
  'Financial Services',
  'Information Technology',
  'Oil, Gas & Fuels',
  'FMCG',
  'Automobile',
  'Metals & Mining',
  'Construction Materials',
  'Capital Goods',
  'Healthcare',
  'Telecommunication',
  'Power',
  'Consumer Services',
  'Consumer Durables',
] as const;

export const HoldingsTableConfigSchema = z.object({
  sortBy: z.enum(HOLDING_SORT_KEYS),
  sortDir: z.enum(['asc', 'desc']),
  sector: z.enum(SECTOR_FILTERS),
  showPnl: z.boolean(),
});

export type HoldingsTableConfig = z.infer<typeof HoldingsTableConfigSchema>;
export type HoldingsTableData = HoldingsData;
export type { Holding };
