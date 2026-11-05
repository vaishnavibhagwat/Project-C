import { cssColor } from '@/theme/themes';
import type { ThemeTokenKey } from '@/types';
import { formatInrCompact, formatPct } from '@/utils/format';
import type {
  ColorScaleId,
  HeatCell,
  HeatHolding,
  SectorHeatMapConfig,
  SectorHeatMapData,
} from './types';

/** Theme tokens for gains and losses. Blue = Series 5, orange = Series 3 in every theme. */
export const SCALE_TOKENS: Record<ColorScaleId, { up: ThemeTokenKey; down: ThemeTokenKey }> = {
  'green-red': { up: 'positive', down: 'negative' },
  'blue-orange': { up: 'chart5', down: 'chart3' },
};

export function sectorOf(h: HeatHolding): string {
  return h.sector ?? h.assetClass;
}

export function scopedHoldings(
  data: SectorHeatMapData,
  config: SectorHeatMapConfig,
): HeatHolding[] {
  return config.scope === 'all'
    ? data.holdings
    : data.holdings.filter((h) => h.assetClass === 'Equity');
}

/** Day P&L % against the previous close value (market value less today's P&L). */
export function pnlPercent(valueInr: number, pnlInr: number): number {
  const previous = valueInr - pnlInr;
  return previous > 0 ? (pnlInr / previous) * 100 : 0;
}

/** One cell per sector, sized by market value, P&L summed over its holdings. */
export function sectorCells(holdings: readonly HeatHolding[]): HeatCell[] {
  const groups = new Map<string, HeatCell>();
  for (const h of holdings) {
    const key = sectorOf(h);
    const g = groups.get(key) ?? {
      key,
      label: key,
      name: key,
      marketValueInr: 0,
      pnlInr: 0,
      pnlPct: 0,
      holdingsCount: 0,
    };
    g.marketValueInr += h.marketValue;
    g.pnlInr += h.dailyPnL;
    g.holdingsCount += 1;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    pnlPct: pnlPercent(g.marketValueInr, g.pnlInr),
  }));
}

/** One cell per holding of a sector. */
export function holdingCells(holdings: readonly HeatHolding[], sector: string): HeatCell[] {
  return holdings
    .filter((h) => sectorOf(h) === sector)
    .map((h) => ({
      key: h.holdingId,
      label: h.ticker,
      name: h.name,
      marketValueInr: h.marketValue,
      pnlInr: h.dailyPnL,
      pnlPct: pnlPercent(h.marketValue, h.dailyPnL),
      holdingsCount: 1,
    }));
}

/** Fill colour and strength for a P&L %: stronger with size, full at `capPct`. */
export function cellFill(pnlPct: number, config: SectorHeatMapConfig) {
  const t = Math.min(1, Math.abs(pnlPct) / config.capPct);
  const strength = 0.14 + t * (0.9 - 0.14);
  const tokens = SCALE_TOKENS[config.colorScale];
  if (Math.abs(pnlPct) < 0.005) return { fill: cssColor('textSubtle'), opacity: 0.18 };
  return { fill: cssColor(pnlPct > 0 ? tokens.up : tokens.down), opacity: strength };
}

/** The sign shown on every cell, so colour is never the only signal. */
export function directionMark(pnlPct: number): '▲' | '▼' | '■' {
  if (Math.abs(pnlPct) < 0.005) return '■';
  return pnlPct > 0 ? '▲' : '▼';
}

export function describeCell(cell: HeatCell): string {
  const holdings = cell.holdingsCount === 1 ? '1 holding' : `${cell.holdingsCount} holdings`;
  return `${cell.name}: ${formatInrCompact(cell.marketValueInr)}, day P&L ${formatInrCompact(cell.pnlInr, true)} (${formatPct(cell.pnlPct / 100, 2)}), ${holdings}.`;
}

export function summarizeHeatMap(cells: readonly HeatCell[]): string {
  if (cells.length === 0) return 'No holdings to show.';
  const sorted = [...cells].sort((a, b) => b.pnlPct - a.pnlPct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const up = cells.filter((c) => c.pnlPct > 0).length;
  if (!best || !worst) return '';
  return `${up} of ${cells.length} up today. Best ${best.label} ${formatPct(best.pnlPct / 100, 2)}, worst ${worst.label} ${formatPct(worst.pnlPct / 100, 2)}.`;
}
