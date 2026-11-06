import { z } from 'zod';
import { ASSET_CLASSES } from '@/data/constants';
import { SectorSchema, type HoldingsData } from '@/data/schemas';
import type { Holding } from '@/types';

export const HOLDING_COLUMN_IDS = [
  'ticker',
  'name',
  'quantity',
  'price',
  'marketValue',
  'dailyPnL',
  'dailyPnLPercent',
  'weight',
  'sector',
  'assetClass',
] as const;
export type HoldingColumnId = (typeof HOLDING_COLUMN_IDS)[number];

export const PAGE_SIZES = ['all', '25', '50', '100'] as const;
export const MOCK_ROW_OPTIONS = ['off', '1000', '5000'] as const;
export const SECTOR_FILTERS = ['all', ...SectorSchema.options, 'none'] as const;
export const ASSET_CLASS_FILTERS = ['all', ...ASSET_CLASSES] as const;
export const PNL_FILTERS = ['all', 'gainers', 'losers'] as const;

const idList = z
  .string()
  .max(300)
  .regex(/^[a-zA-Z,]*$/);

export const HoldingsTableConfigSchema = z.object({
  /** Sort keys in priority order, e.g. "weight:desc,ticker:asc" (set from the headers). */
  sort: z
    .string()
    .max(300)
    .regex(/^([a-zA-Z]+:(asc|desc))?(,[a-zA-Z]+:(asc|desc))*$/),
  /** Column order (ids, comma-separated; set by dragging headers). Empty = default order. */
  columnOrder: idList,
  /** Hidden column ids, comma-separated (set from the Columns menu). */
  hiddenColumns: idList,
  /** "all" = one virtual-scrolling list; otherwise rows per page. */
  pageSize: z.enum(PAGE_SIZES),
  /** Performance demo: replace the book with this many generated rows. */
  mockRows: z.enum(MOCK_ROW_OPTIONS),
  /** Filters (combined): a sector ("none" = no sector), an asset class, the day's P&L sign. */
  filterSector: z.enum(SECTOR_FILTERS),
  filterAssetClass: z.enum(ASSET_CLASS_FILTERS),
  filterPnl: z.enum(PNL_FILTERS),
});

export type HoldingsTableConfig = z.infer<typeof HoldingsTableConfigSchema>;
export type HoldingsTableData = HoldingsData;
export type { Holding };
