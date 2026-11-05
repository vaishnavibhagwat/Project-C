import { z } from 'zod';
import type { HoldingsData } from '@/data/schemas';

export const COLOR_SCALES = ['green-red', 'blue-orange'] as const;
export type ColorScaleId = (typeof COLOR_SCALES)[number];

export const SectorHeatMapConfigSchema = z.object({
  /** green-red (default) or blue-orange, which reads for red-green colour blindness. */
  colorScale: z.enum(COLOR_SCALES),
  /** Daily P&L % at which colour reaches full strength. */
  capPct: z.number().min(0.5).max(10),
  /** Equity sectors only, or the whole book (non-equity grouped by asset class). */
  scope: z.enum(['equity', 'all']),
});

export type SectorHeatMapConfig = z.infer<typeof SectorHeatMapConfigSchema>;
export type SectorHeatMapData = HoldingsData;
export type HeatHolding = SectorHeatMapData['holdings'][number];

/** One rectangle: a sector (top level) or a holding (zoomed into a sector). */
export interface HeatCell {
  key: string;
  label: string;
  /** Full name for the tooltip (sector name, or the holding's name). */
  name: string;
  marketValueInr: number;
  /** Day P&L in INR. */
  pnlInr: number;
  /** Day P&L as a percentage of the previous close value (1.25 = 1.25%). */
  pnlPct: number;
  holdingsCount: number;
}

export interface PlacedCell extends HeatCell {
  x: number;
  y: number;
  w: number;
  h: number;
}
