import { formatPct } from '@/utils/format';
import type { VolatilityHistoryConfig, VolatilityHistoryData, VolPoint } from './types';

const TRADING_DAYS = 252;
const RANGE_DAYS = { '1Y': 252, '3Y': 756, '5Y': 1260 } as const;

/**
 * Rolling annualised volatility: the sample standard deviation of the last `window` daily
 * returns × √252, for the fund and the Nifty 50, over the chosen range.
 */
export function rollingVolatility(
  data: VolatilityHistoryData,
  config: VolatilityHistoryConfig,
): VolPoint[] {
  const w = Number(config.window);
  const pts = data.points;
  const ret = (key: 'nav' | 'benchmark') =>
    pts.map((p, i) => (i === 0 ? 0 : p[key] / (pts[i - 1]?.[key] ?? p[key]) - 1));
  const fund = ret('nav');
  const bench = ret('benchmark');
  const vol = (xs: readonly number[], end: number) => {
    const slice = xs.slice(end - w + 1, end + 1);
    const m = slice.reduce((s, x) => s + x, 0) / slice.length;
    const v = slice.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, slice.length - 1);
    return Math.sqrt(v * TRADING_DAYS) * 100;
  };
  const start = Math.max(w, pts.length - RANGE_DAYS[config.range]);
  const out: VolPoint[] = [];
  for (let i = start; i < pts.length; i += 1) {
    out.push({ date: pts[i]?.date ?? '', fund: vol(fund, i), benchmark: vol(bench, i) });
  }
  return out;
}

export function volSummary(points: readonly VolPoint[], config: VolatilityHistoryConfig): string {
  const last = points[points.length - 1];
  if (!last) return 'Not enough history for rolling volatility.';
  const fundVals = points.map((p) => p.fund);
  const hi = Math.max(...fundVals);
  const lo = Math.min(...fundVals);
  return `${config.window}-day rolling volatility (annualised): fund ${formatPct(last.fund / 100, 1, false)}, Nifty 50 ${formatPct(last.benchmark / 100, 1, false)}. Over ${config.range} the fund ranged ${formatPct(lo / 100, 1, false)} to ${formatPct(hi / 100, 1, false)}.`;
}
