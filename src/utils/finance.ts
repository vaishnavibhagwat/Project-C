/**
 * Portfolio maths. These are standard textbook formulas applied to simulated daily data.
 * Assumptions (documented in docs/ASSUMPTIONS.md):
 * - 252 trading days per year; returns are simple daily returns.
 * - Annualised volatility = daily stdev * sqrt(252).
 * - Sharpe uses arithmetic annualised mean return minus the risk-free rate.
 * - VaR is reported as a positive loss fraction of portfolio value over a 1-day horizon.
 */

export const TRADING_DAYS_PER_YEAR = 252;

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

/** Sample standard deviation (n - 1). */
export function stdev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let acc = 0;
  for (const v of values) acc += (v - m) ** 2;
  return Math.sqrt(acc / (values.length - 1));
}

export function simpleReturns(levels: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < levels.length; i += 1) {
    const prev = levels[i - 1];
    const curr = levels[i];
    if (prev === undefined || curr === undefined || prev === 0) continue;
    out.push(curr / prev - 1);
  }
  return out;
}

/** Continuously compounded returns ln(P_t / P_t-1). */
export function logReturns(levels: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < levels.length; i += 1) {
    const prev = levels[i - 1];
    const curr = levels[i];
    if (prev === undefined || curr === undefined || prev <= 0 || curr <= 0) continue;
    out.push(Math.log(curr / prev));
  }
  return out;
}

/** Compounded total return of a sequence of simple returns: prod(1 + r) - 1. */
export function cumulativeReturn(returns: readonly number[]): number {
  let growth = 1;
  for (const r of returns) growth *= 1 + r;
  return growth - 1;
}

/** One geometric Brownian motion step: S * exp((mu - sigma^2 / 2) dt + sigma sqrt(dt) Z). */
export function gbmStep(price: number, mu: number, sigma: number, dt: number, z: number): number {
  return price * Math.exp((mu - (sigma * sigma) / 2) * dt + sigma * Math.sqrt(dt) * z);
}

export function annualisedVolatility(dailyReturns: readonly number[]): number {
  return stdev(dailyReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

export function annualisedReturn(dailyReturns: readonly number[]): number {
  return mean(dailyReturns) * TRADING_DAYS_PER_YEAR;
}

/** Compound annual growth rate from first to last level. */
export function cagr(levels: readonly number[]): number {
  const first = levels[0];
  const last = levels[levels.length - 1];
  if (first === undefined || last === undefined || first <= 0 || levels.length < 2) return 0;
  const years = (levels.length - 1) / TRADING_DAYS_PER_YEAR;
  return (last / first) ** (1 / years) - 1;
}

export function sharpeRatio(dailyReturns: readonly number[], riskFreeAnnual: number): number {
  const vol = annualisedVolatility(dailyReturns);
  return vol === 0 ? 0 : (annualisedReturn(dailyReturns) - riskFreeAnnual) / vol;
}

/** Sortino with downside deviation measured against the daily risk-free rate. */
export function sortinoRatio(dailyReturns: readonly number[], riskFreeAnnual: number): number {
  const target = riskFreeAnnual / TRADING_DAYS_PER_YEAR;
  if (dailyReturns.length === 0) return 0;
  let acc = 0;
  for (const r of dailyReturns) {
    const shortfall = Math.min(0, r - target);
    acc += shortfall * shortfall;
  }
  const downside = Math.sqrt(acc / dailyReturns.length) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  return downside === 0 ? 0 : (annualisedReturn(dailyReturns) - riskFreeAnnual) / downside;
}

export interface DrawdownPoint {
  index: number;
  drawdown: number;
}

/** Drawdown from running peak at each point (0 or negative fractions). */
export function drawdownSeries(levels: readonly number[]): number[] {
  let peak = -Infinity;
  return levels.map((level) => {
    peak = Math.max(peak, level);
    return peak > 0 ? level / peak - 1 : 0;
  });
}

export interface MaxDrawdown {
  /** Positive fraction, e.g. 0.35 for a 35% fall. */
  depth: number;
  peakIndex: number;
  troughIndex: number;
  /** Index where the previous peak was regained, or null if not yet recovered. */
  recoveryIndex: number | null;
  /** Periods from peak to trough (the fall). */
  declinePeriods: number;
  /** Periods from trough back to the old peak (the recovery period), or null if not recovered. */
  recoveryPeriods: number | null;
  /** Periods from peak to recovery (time under water), or null if not recovered. */
  underwaterPeriods: number | null;
}

/**
 * Deepest peak-to-trough fall and how long it took to recover. Periods are counted in the
 * series' own steps (trading days for daily data).
 */
export function maxDrawdown(levels: readonly number[]): MaxDrawdown {
  let peak = levels[0] ?? 0;
  let peakIndex = 0;
  let depth = 0;
  let best = { peakIndex: 0, troughIndex: 0 };
  levels.forEach((level, i) => {
    if (level > peak) {
      peak = level;
      peakIndex = i;
    }
    const fall = peak > 0 ? 1 - level / peak : 0;
    if (fall > depth) {
      depth = fall;
      best = { peakIndex, troughIndex: i };
    }
  });
  const peakLevel = levels[best.peakIndex] ?? 0;
  let recoveryIndex: number | null = null;
  for (let i = best.troughIndex + 1; i < levels.length; i += 1) {
    if ((levels[i] ?? 0) >= peakLevel) {
      recoveryIndex = i;
      break;
    }
  }
  return {
    depth,
    ...best,
    recoveryIndex,
    declinePeriods: best.troughIndex - best.peakIndex,
    recoveryPeriods: recoveryIndex === null ? null : recoveryIndex - best.troughIndex,
    underwaterPeriods: recoveryIndex === null ? null : recoveryIndex - best.peakIndex,
  };
}

export function covariance(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let acc = 0;
  for (let i = 0; i < n; i += 1) acc += ((a[i] ?? 0) - ma) * ((b[i] ?? 0) - mb);
  return acc / (n - 1);
}

/** Pearson correlation of two series (over their common length); 0 when either is flat. */
export function correlation(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  const sa = stdev(a.slice(0, n));
  const sb = stdev(b.slice(0, n));
  if (sa === 0 || sb === 0) return 0;
  // Clamp rounding noise so a perfect relationship reads exactly ±1.
  return Math.max(-1, Math.min(1, covariance(a, b) / (sa * sb)));
}

/** Symmetric matrix of pairwise correlations with 1 on the diagonal. */
export function correlationMatrix(series: readonly (readonly number[])[]): number[][] {
  const out = series.map((_, i) => series.map((__, j): number => (i === j ? 1 : 0)));
  for (let i = 0; i < series.length; i += 1) {
    for (let j = i + 1; j < series.length; j += 1) {
      const rho = correlation(series[i] ?? [], series[j] ?? []);
      const rowI = out[i];
      const rowJ = out[j];
      if (rowI) rowI[j] = rho;
      if (rowJ) rowJ[i] = rho;
    }
  }
  return out;
}

export function beta(asset: readonly number[], benchmark: readonly number[]): number {
  const s = stdev(benchmark);
  return s === 0 ? 0 : covariance(asset, benchmark) / (s * s);
}

export function trackingError(asset: readonly number[], benchmark: readonly number[]): number {
  const n = Math.min(asset.length, benchmark.length);
  const active = Array.from({ length: n }, (_, i) => (asset[i] ?? 0) - (benchmark[i] ?? 0));
  return annualisedVolatility(active);
}

/** Empirical quantile with linear interpolation (type 7, same as numpy default). */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

/** Historical-simulation 1-day VaR as a positive loss fraction. */
export function historicalVaR(dailyReturns: readonly number[], confidence: number): number {
  return Math.max(0, -quantile(dailyReturns, 1 - confidence));
}

/** Expected shortfall: average loss beyond the historical VaR threshold. */
export function historicalCVaR(dailyReturns: readonly number[], confidence: number): number {
  const threshold = quantile(dailyReturns, 1 - confidence);
  const tail = dailyReturns.filter((r) => r <= threshold);
  return tail.length === 0 ? 0 : Math.max(0, -mean(tail));
}

/** Inverse standard normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
const A = [
  -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716,
  2.506628277459239,
] as const;
const B = [
  -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572,
] as const;
const C = [
  -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
  4.374664141464968, 2.938163982698783,
] as const;
const D = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416] as const;

function tail(q: number): number {
  const num = ((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5];
  const den = (((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1;
  return num / den;
}

export function inverseNormalCdf(p: number): number {
  if (p <= 0 || p >= 1) throw new RangeError('p must be in (0, 1)');
  const low = 0.02425;
  if (p < low) return tail(Math.sqrt(-2 * Math.log(p)));
  if (p > 1 - low) return -tail(Math.sqrt(-2 * Math.log(1 - p)));
  const q = p - 0.5;
  const r = q * q;
  const num = (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q;
  const den = ((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1;
  return num / den;
}

/** Variance-covariance (normal) 1-day VaR as a positive loss fraction: -(mu - z * sigma). */
export function parametricVaR(dailyReturns: readonly number[], confidence: number): number {
  const z = inverseNormalCdf(confidence);
  return Math.max(0, -(mean(dailyReturns) - z * stdev(dailyReturns)));
}

export type VarMethod = 'historical' | 'parametric';

export interface VarEstimate {
  /** 1-day loss fractions at 95% and 99% confidence. */
  var95: number;
  var99: number;
}

/** Historical and parametric 1-day VaR at 95% and 99% from one return series. */
export function valueAtRisk(dailyReturns: readonly number[]): Record<VarMethod, VarEstimate> {
  return {
    historical: {
      var95: historicalVaR(dailyReturns, 0.95),
      var99: historicalVaR(dailyReturns, 0.99),
    },
    parametric: {
      var95: parametricVaR(dailyReturns, 0.95),
      var99: parametricVaR(dailyReturns, 0.99),
    },
  };
}

/** One segment (sector, asset class …) of a Brinson attribution. Weights and returns as fractions. */
export interface BrinsonSegment {
  key: string;
  portfolioWeight: number;
  benchmarkWeight: number;
  portfolioReturn: number;
  benchmarkReturn: number;
}

export interface BrinsonEffects {
  allocation: number;
  selection: number;
  interaction: number;
  /** allocation + selection + interaction */
  total: number;
}

export interface BrinsonResult extends BrinsonEffects {
  segments: (BrinsonEffects & { key: string })[];
  portfolioReturn: number;
  benchmarkReturn: number;
  /** portfolioReturn - benchmarkReturn; equals `total` when both weight sets sum to 1. */
  activeReturn: number;
}

/**
 * Single-period Brinson attribution, three effects per segment:
 * - allocation  = (wp - wb) * (rb - Rb)   Brinson-Fachler (default), or (wp - wb) * rb for
 *   Brinson-Hood-Beebower ('BHB'); both sum to the same total when weights sum to 1;
 * - selection   = wb * (rp - rb);
 * - interaction = (wp - wb) * (rp - rb).
 * Rb is the total benchmark return. Single period, no cash flows or compounding across periods.
 */
export function brinsonAttribution(
  segments: readonly BrinsonSegment[],
  method: 'BF' | 'BHB' = 'BF',
): BrinsonResult {
  const portfolioReturn = sum(segments.map((s) => s.portfolioWeight * s.portfolioReturn));
  const benchmarkReturn = sum(segments.map((s) => s.benchmarkWeight * s.benchmarkReturn));
  const rows = segments.map((s) => {
    const activeWeight = s.portfolioWeight - s.benchmarkWeight;
    const allocation =
      activeWeight * (method === 'BF' ? s.benchmarkReturn - benchmarkReturn : s.benchmarkReturn);
    const selection = s.benchmarkWeight * (s.portfolioReturn - s.benchmarkReturn);
    const interaction = activeWeight * (s.portfolioReturn - s.benchmarkReturn);
    return {
      key: s.key,
      allocation,
      selection,
      interaction,
      total: allocation + selection + interaction,
    };
  });
  const allocation = sum(rows.map((r) => r.allocation));
  const selection = sum(rows.map((r) => r.selection));
  const interaction = sum(rows.map((r) => r.interaction));
  return {
    segments: rows,
    allocation,
    selection,
    interaction,
    total: allocation + selection + interaction,
    portfolioReturn,
    benchmarkReturn,
    activeReturn: portfolioReturn - benchmarkReturn,
  };
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

export function histogram(values: readonly number[], bins: number): HistogramBin[] {
  if (values.length === 0 || bins <= 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const out: HistogramBin[] = Array.from({ length: bins }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / width));
    const bin = out[idx];
    if (bin) bin.count += 1;
  }
  return out;
}
