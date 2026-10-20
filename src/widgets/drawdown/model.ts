import { drawdownSeries, maxDrawdown } from '@/utils/finance';
import type { DrawdownConfig, DrawdownData, DrawdownPoint } from './types';

const DAYS = { '1Y': 252, '3Y': 756, '5Y': 1260 } as const;

export interface DrawdownModel {
  points: DrawdownPoint[];
  maxDepth: number;
  peakDate: string | null;
  troughDate: string | null;
  recoveryDate: string | null;
  current: number;
}

/** Drawdown (in %) from the running peak inside the selected window. */
export function buildDrawdown(data: DrawdownData, config: DrawdownConfig): DrawdownModel {
  const slice = data.points.slice(Math.max(0, data.points.length - 1 - DAYS[config.range]));
  const navs = slice.map((p) => p.nav);
  const fund = drawdownSeries(navs);
  const bench = drawdownSeries(slice.map((p) => p.benchmark));
  const dd = maxDrawdown(navs);
  return {
    points: slice.map((p, i) => ({
      date: p.date,
      fund: (fund[i] ?? 0) * 100,
      benchmark: (bench[i] ?? 0) * 100,
    })),
    maxDepth: dd.depth,
    peakDate: slice[dd.peakIndex]?.date ?? null,
    troughDate: slice[dd.troughIndex]?.date ?? null,
    recoveryDate: dd.recoveryIndex === null ? null : (slice[dd.recoveryIndex]?.date ?? null),
    current: -(fund[fund.length - 1] ?? 0),
  };
}
