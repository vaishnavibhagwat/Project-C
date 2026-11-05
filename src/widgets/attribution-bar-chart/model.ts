import { brinsonAttribution, type BrinsonSegment } from '@/utils/finance';
import { formatDateKey } from '@/utils/time';
import type {
  AttributionBarChartData,
  Grouping,
  HoldingContribution,
  InputPosition,
  PeriodWindow,
  SegmentAttribution,
  WindowAttribution,
} from './types';

/** Below this active return (5 bps) a "share of active return" view is not meaningful. */
export const RELATIVE_MIN_ACTIVE = 0.0005;

export const GROUPING_LABELS: Record<Grouping, string> = {
  sector: 'Sector',
  factor: 'Factor',
  'asset-class': 'Asset class',
};

/** Beta factor buckets (approximation of a market-sensitivity factor). */
export function betaBucket(beta: number): string {
  if (beta >= 1.1) return 'High beta (β ≥ 1.1)';
  if (beta < 0.9) return 'Low beta (β < 0.9)';
  return 'Market beta';
}

const pad = (n: number) => String(n).padStart(2, '0');
const monthStart = (y: number, m: number) => {
  const yy = m < 1 ? y - 1 : m > 12 ? y + 1 : y;
  const mm = m < 1 ? m + 12 : m > 12 ? m - 12 : m;
  return `${yy}-${pad(mm)}-01`;
};

/** Last index whose date is before `dateKey` (−1 if none). */
function lastBefore(dates: readonly string[], dateKey: string): number {
  let found = -1;
  for (let i = 0; i < dates.length; i += 1) if ((dates[i] ?? '') < dateKey) found = i;
  return found;
}

/** Last index on or before `dateKey` (−1 if none). */
function lastOnOrBefore(dates: readonly string[], dateKey: string): number {
  let found = -1;
  for (let i = 0; i < dates.length; i += 1) if ((dates[i] ?? '') <= dateKey) found = i;
  return found;
}

function makeWindow(
  dates: readonly string[],
  key: PeriodWindow['key'],
  label: string,
  start: number,
  end: number,
): PeriodWindow | null {
  if (start < 0 || end <= start || end >= dates.length) return null;
  return { key, label, start, end, from: dates[start] ?? '', to: dates[end] ?? '' };
}

/**
 * This month (from the last close of the previous month), last month, and the same calendar
 * month a year earlier; plus a range from DATE_RANGE_CHANGED when one is given and covered.
 */
export function periodWindows(
  dates: readonly string[],
  range: { from: string; to: string } | null = null,
): PeriodWindow[] {
  const last = dates.length - 1;
  const today = dates[last] ?? '';
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const mtdStart = lastBefore(dates, monthStart(y, m));
  const prevStart = lastBefore(dates, monthStart(y, m - 1));
  const yoyStart = lastBefore(dates, monthStart(y - 1, m));
  const yoyEnd = lastBefore(dates, monthStart(y - 1, m + 1));
  const monthName = (yy: number, mm: number) =>
    formatDateKey(monthStart(yy, mm)).replace(/^1 /, '');
  const windows = [
    makeWindow(dates, 'mtd', `This month (${monthName(y, m)})`, mtdStart, last),
    makeWindow(dates, 'prev', `Last month (${monthName(y, m - 1)})`, prevStart, mtdStart),
    makeWindow(dates, 'yoy', `Same month last year (${monthName(y - 1, m)})`, yoyStart, yoyEnd),
  ];
  if (range) {
    const start = lastOnOrBefore(dates, range.from);
    const end = lastOnOrBefore(dates, range.to);
    windows.push(
      makeWindow(
        dates,
        'range',
        `Selected range (${formatDateKey(range.from)} – ${formatDateKey(range.to)})`,
        start,
        end,
      ),
    );
  }
  return windows.filter((w): w is PeriodWindow => w !== null);
}

/** Positions of the sleeve a grouping attributes, with the segment each falls in. */
function sleeve(
  data: AttributionBarChartData,
  grouping: Grouping,
): { p: InputPosition; key: string }[] {
  return data.positions.flatMap((p) => {
    if (grouping === 'asset-class') return [{ p, key: p.assetClass }];
    if (p.assetClass !== 'Equity') return [];
    if (grouping === 'sector') return p.sector ? [{ p, key: p.sector }] : [];
    return p.beta === null ? [] : [{ p, key: betaBucket(p.beta) }];
  });
}

const growth = (series: readonly number[], w: PeriodWindow) => {
  const a = series[w.start] ?? 0;
  return a > 0 ? (series[w.end] ?? a) / a - 1 : 0;
};

interface Bucket {
  pv0: number;
  pv1: number;
  bw: number;
  bwr: number;
}

/** Benchmark weights and returns per segment (index weights, or the policy for asset classes). */
function benchmarkBuckets(
  data: AttributionBarChartData,
  grouping: Grouping,
  w: PeriodWindow,
  buckets: Map<string, Bucket>,
) {
  const get = (key: string) => {
    const b = buckets.get(key) ?? { pv0: 0, pv1: 0, bw: 0, bwr: 0 };
    buckets.set(key, b);
    return b;
  };
  if (grouping === 'asset-class') {
    const levels = data.policy.levels;
    (['Equity', 'Fixed Income', 'Alternatives'] as const).forEach((cls) => {
      const weight = data.policy.weightsPct[cls] / 100;
      const b = get(cls);
      b.bw += weight;
      b.bwr += weight * growth(levels[cls], w);
    });
    return;
  }
  const total = data.benchmark.reduce((s, c) => s + c.weightPct, 0) || 1;
  for (const c of data.benchmark) {
    const weight = c.weightPct / total;
    const b = get(grouping === 'sector' ? c.sector : betaBucket(c.beta));
    b.bw += weight;
    b.bwr += weight * growth(c.closes, w);
  }
}

/** Brinson-Fachler attribution of the grouping's sleeve over one window. */
export function attributeWindow(
  data: AttributionBarChartData,
  grouping: Grouping,
  w: PeriodWindow,
): WindowAttribution {
  const buckets = new Map<string, Bucket>();
  let total0 = 0;
  for (const { p, key } of sleeve(data, grouping)) {
    const b = buckets.get(key) ?? { pv0: 0, pv1: 0, bw: 0, bwr: 0 };
    b.pv0 += p.values[w.start] ?? 0;
    b.pv1 += p.values[w.end] ?? 0;
    total0 += p.values[w.start] ?? 0;
    buckets.set(key, b);
  }
  benchmarkBuckets(data, grouping, w, buckets);
  const benchmarkTotal = [...buckets.values()].reduce((s, b) => s + b.bwr, 0);

  const segments: (BrinsonSegment & { label: string })[] = [...buckets.entries()].map(
    ([key, b]) => {
      // No benchmark weight: measure against the total benchmark (allocation then 0).
      const rb = b.bw > 0 ? b.bwr / b.bw : benchmarkTotal;
      const rp = b.pv0 > 0 ? b.pv1 / b.pv0 - 1 : rb;
      return {
        key,
        label: key,
        portfolioWeight: total0 > 0 ? b.pv0 / total0 : 0,
        benchmarkWeight: b.bw,
        portfolioReturn: rp,
        benchmarkReturn: rb,
      };
    },
  );
  const result = brinsonAttribution(segments, 'BF');
  const rows: SegmentAttribution[] = segments.map((s, i) => {
    const r = result.segments[i];
    return {
      key: s.key,
      label: s.label,
      portfolioWeight: s.portfolioWeight,
      benchmarkWeight: s.benchmarkWeight,
      portfolioReturn: s.portfolioReturn,
      benchmarkReturn: s.benchmarkReturn,
      allocation: r?.allocation ?? 0,
      selection: r?.selection ?? 0,
      interaction: r?.interaction ?? 0,
      total: r?.total ?? 0,
    };
  });
  rows.sort(
    (a, b) => b.portfolioWeight + b.benchmarkWeight - (a.portfolioWeight + a.benchmarkWeight),
  );
  return {
    window: w,
    segments: rows,
    allocation: result.allocation,
    selection: result.selection,
    interaction: result.interaction,
    active: result.activeReturn,
    portfolioReturn: result.portfolioReturn,
    benchmarkReturn: result.benchmarkReturn,
  };
}

/**
 * Each holding's share of a segment's selection and interaction effects: sleeve weight at the
 * start × (holding return − the segment's benchmark return). They sum to selection +
 * interaction for the segment (Brinson-Fachler).
 */
export function holdingContributions(
  data: AttributionBarChartData,
  grouping: Grouping,
  attribution: WindowAttribution,
  segmentKey: string,
): HoldingContribution[] {
  const w = attribution.window;
  const members = sleeve(data, grouping);
  const total0 = members.reduce((s, m) => s + (m.p.values[w.start] ?? 0), 0);
  const seg = attribution.segments.find((s) => s.key === segmentKey);
  if (!seg || total0 <= 0) return [];
  return members
    .filter((m) => m.key === segmentKey)
    .map(({ p }) => {
      const weight = (p.values[w.start] ?? 0) / total0;
      const r = growth(p.values, w);
      return {
        key: p.key,
        label: p.ticker,
        name: p.name,
        weight,
        return: r,
        contribution: weight * (r - seg.benchmarkReturn),
      };
    })
    .sort((a, b) => b.contribution - a.contribution);
}

/** An effect in the chosen unit: basis points, or % of the window's active return. */
export function inUnit(value: number, unit: 'bps' | 'pct', active: number): number {
  if (unit === 'bps') return value * 10_000;
  return Math.abs(active) >= RELATIVE_MIN_ACTIVE ? (value / active) * 100 : 0;
}

export function formatUnit(value: number, unit: 'bps' | 'pct'): string {
  const sign = value > 0.05 ? '+' : value < -0.05 ? '−' : '';
  const body = Math.abs(value).toFixed(unit === 'bps' ? 0 : 1);
  return unit === 'bps' ? `${sign}${body} bps` : `${sign}${body}%`;
}

export function summarizeWindow(a: WindowAttribution, grouping: Grouping): string {
  const bps = (v: number) => formatUnit(v * 10_000, 'bps');
  const top = [...a.segments].sort((x, y) => Math.abs(y.total) - Math.abs(x.total))[0];
  return (
    `${a.window.label}, by ${GROUPING_LABELS[grouping].toLowerCase()}: active return ${bps(a.active)} ` +
    `(allocation ${bps(a.allocation)}, selection ${bps(a.selection)}, interaction ${bps(a.interaction)}).` +
    (top ? ` Largest: ${top.label} ${bps(top.total)}.` : '')
  );
}
