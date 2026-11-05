import { cssColor, seriesColor, CHART_SERIES } from '@/theme/themes';
import type {
  Dimension,
  DrillStep,
  PieHolding,
  PieLevel,
  PiePalette,
  PieSlice,
  PortfolioPieChartConfig,
  PortfolioPieChartData,
} from './types';

/** At most this many slices; the smallest groups beyond it are combined into "Other". */
export const MAX_SLICES = 7;

export const DIMENSION_LABELS: Record<Dimension, string> = {
  'asset-class': 'Asset class',
  sector: 'Sector',
  geography: 'Geography',
  'instrument-type': 'Instrument type',
  currency: 'Currency',
  holding: 'Holding',
};

/** Drill order after each top-level dimension. Levels with a single group are skipped. */
const DRILL_ORDER: Record<Dimension, readonly Dimension[]> = {
  'asset-class': ['sector', 'holding'],
  sector: ['holding'],
  geography: ['asset-class', 'sector', 'holding'],
  'instrument-type': ['holding'],
  currency: ['asset-class', 'sector', 'holding'],
  holding: [],
};

export function topDimension(config: PortfolioPieChartConfig): Dimension {
  return config.grouping === 'custom' ? config.customField : config.grouping;
}

/** The group a holding falls into for a dimension. Non-equity holdings have no sector, so the
 * sector view groups them by asset class (e.g. "Fixed Income"). */
export function groupOf(h: PieHolding, dimension: Dimension): { key: string; label: string } {
  switch (dimension) {
    case 'asset-class':
      return { key: h.assetClass, label: h.assetClass };
    case 'sector':
      return h.sector
        ? { key: h.sector, label: h.sector }
        : { key: `class:${h.assetClass}`, label: h.assetClass };
    case 'geography':
      return { key: h.geography, label: h.geography };
    case 'instrument-type':
      return { key: h.instrumentType, label: h.instrumentType };
    case 'currency':
      return { key: h.currency, label: h.currency };
    case 'holding':
      return { key: h.holdingId, label: h.ticker };
  }
}

interface Group {
  key: string;
  label: string;
  valueInr: number;
  count: number;
}

function groupBy(holdings: readonly PieHolding[], dimension: Dimension): Group[] {
  const groups = new Map<string, Group>();
  for (const h of holdings) {
    const { key, label } = groupOf(h, dimension);
    const g = groups.get(key) ?? { key, label, valueInr: 0, count: 0 };
    g.valueInr += h.marketValue;
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.valueInr - a.valueInr);
}

/** The next dimension to show below `after`, skipping levels with only one group. */
function nextDimension(
  top: Dimension,
  after: Dimension,
  holdings: readonly PieHolding[],
): Dimension | null {
  const order = [top, ...DRILL_ORDER[top]];
  for (const dim of order.slice(order.indexOf(after) + 1)) {
    if (dim === 'holding' || groupBy(holdings, dim).length > 1) return dim;
  }
  return null;
}

/**
 * The pie for the current drill path: holdings filtered by each step, grouped by the next
 * dimension. Steps that no longer match any holding (e.g. after a data refresh) are dropped.
 */
export function buildLevel(
  data: PortfolioPieChartData,
  config: PortfolioPieChartConfig,
  path: readonly DrillStep[],
): PieLevel {
  const top = topDimension(config);
  const bookInr = data.holdings.reduce((s, h) => s + h.marketValue, 0);
  let holdings: readonly PieHolding[] = data.holdings;
  let dimension: Dimension = top;
  const applied: DrillStep[] = [];
  for (const step of path) {
    if (step.dimension !== dimension) break;
    const inside = holdings.filter((h) => groupOf(h, step.dimension).key === step.key);
    const next = nextDimension(top, dimension, inside);
    if (inside.length === 0 || next === null) break;
    holdings = inside;
    dimension = next;
    applied.push(step);
  }

  const totalInr = holdings.reduce((s, h) => s + h.marketValue, 0);
  const groups = groupBy(holdings, dimension);
  const head = groups.length > MAX_SLICES ? groups.slice(0, MAX_SLICES - 1) : groups;
  const tail = groups.length > MAX_SLICES ? groups.slice(MAX_SLICES - 1) : [];
  const pct = (v: number, of: number) => (of > 0 ? (v / of) * 100 : 0);

  const slices: PieSlice[] = head.map((g) => ({
    key: g.key,
    label: g.label,
    valueInr: g.valueInr,
    sharePct: pct(g.valueInr, totalInr),
    bookPct: pct(g.valueInr, bookInr),
    count: g.count,
    drillable: dimension !== 'holding' && g.count > 1,
    isOther: false,
  }));
  if (tail.length > 0) {
    const valueInr = tail.reduce((s, g) => s + g.valueInr, 0);
    const noun =
      dimension === 'holding' ? 'holdings' : `${DIMENSION_LABELS[dimension].toLowerCase()}s`;
    slices.push({
      key: 'other',
      label: `Other (${tail.length} ${noun})`,
      valueInr,
      sharePct: pct(valueInr, totalInr),
      bookPct: pct(valueInr, bookInr),
      count: tail.reduce((s, g) => s + g.count, 0),
      drillable: false,
      isOther: true,
    });
  }

  return {
    dimension,
    title: DIMENSION_LABELS[dimension],
    path: applied,
    slices,
    totalInr,
    bookPct: pct(totalInr, bookInr),
  };
}

/** The drill path after clicking a slice, or null when the slice has no breakdown. */
export function drillInto(level: PieLevel, slice: PieSlice): DrillStep[] | null {
  if (!slice.drillable) return null;
  return [...level.path, { dimension: level.dimension, key: slice.key, label: slice.label }];
}

/**
 * Index of the slice that contains `symbol` at this level, or null if the symbol is not in
 * it. Used by the SYMBOL_SELECTED hook point to highlight a holding chosen elsewhere.
 */
export function sliceIndexForSymbol(
  data: PortfolioPieChartData,
  level: PieLevel,
  symbol: string,
): number | null {
  const holding = data.holdings.find((h) => h.ticker === symbol);
  if (!holding) return null;
  const inPath = level.path.every((s) => groupOf(holding, s.dimension).key === s.key);
  if (!inPath) return null;
  const { key } = groupOf(holding, level.dimension);
  const direct = level.slices.findIndex((s) => s.key === key);
  if (direct >= 0) return direct;
  const other = level.slices.findIndex((s) => s.isOther);
  return other >= 0 ? other : null;
}

/** Slice colour for a palette. Every colour is a theme CSS variable. */
export function sliceColor(palette: PiePalette, index: number, slice: PieSlice, count: number) {
  if (slice.isOther) return cssColor('textSubtle', palette === 'soft' ? 0.45 : 0.7);
  if (palette === 'monochrome') {
    const step = count > 1 ? 0.7 / (count - 1) : 0;
    return cssColor('accent', Math.round((1 - index * step) * 100) / 100);
  }
  if (palette === 'soft') {
    return cssColor(CHART_SERIES[index % CHART_SERIES.length] ?? 'chart1', 0.55);
  }
  return seriesColor(index);
}

export function summarizePie(level: PieLevel): string {
  if (level.slices.length === 0) return 'No holdings to show.';
  const top = level.slices
    .slice(0, 3)
    .map((s) => `${s.label} ${s.sharePct.toFixed(1)}%`)
    .join(', ');
  const more = level.slices.length > 3 ? `, and ${level.slices.length - 3} more` : '';
  const within =
    level.path.length > 0 ? ` within ${level.path.map((s) => s.label).join(' › ')}` : '';
  return `Allocation by ${level.title.toLowerCase()}${within}: ${top}${more}.`;
}
