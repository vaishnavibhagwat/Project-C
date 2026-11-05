import { correlation, correlationMatrix, mean, stdev } from '@/utils/finance';
import type { CorrelationMatrixConfig, CorrelationMatrixData, ReturnSeries } from './types';

/** The series the matrix compares, each cut to the last `lookback` returns. */
export function selectSeries(
  data: CorrelationMatrixData,
  config: CorrelationMatrixConfig,
): { dates: string[]; series: ReturnSeries[] } {
  const n = Number(config.lookback);
  const pool = config.subject === 'holdings' ? data.holdings : data.sectors;
  return {
    dates: data.dates.slice(-n),
    series: pool
      .slice(0, Number(config.count))
      .map((s) => ({ ...s, returns: s.returns.slice(-n) })),
  };
}

/** Pairwise Pearson correlations (finance.correlationMatrix); 1 on the diagonal. */
export function buildMatrix(series: readonly ReturnSeries[]): number[][] {
  return correlationMatrix(series.map((s) => s.returns)).map((row) =>
    row.map((r) => (Number.isFinite(r) ? r : 0)),
  );
}

/** Correlation printed in a cell: two decimals, a real minus sign. */
export function formatCorrelation(r: number): string {
  const text = Math.abs(r).toFixed(2);
  return r < -0.005 ? `−${text}` : text;
}

/** Short form for small cells: no leading zero (".62", "−.41", "1"). */
export function formatCorrelationShort(r: number): string {
  return formatCorrelation(r).replace(/^(−?)0\./, '$1.');
}

export function cellLabel(a: ReturnSeries, b: ReturnSeries, r: number): string {
  return `${a.label} vs ${b.label}: ${formatCorrelation(r)}`;
}

export interface PairStats {
  correlation: number;
  /** Slope of b on a (b's beta to a). */
  beta: number;
  days: number;
  points: { x: number; y: number; date: string }[];
}

/** Daily returns of two series side by side, for the scatter plot. */
export function pairStats(a: ReturnSeries, b: ReturnSeries, dates: readonly string[]): PairStats {
  const n = Math.min(a.returns.length, b.returns.length, dates.length);
  const xs = a.returns.slice(-n);
  const ys = b.returns.slice(-n);
  const days = dates.slice(-n);
  const sx = stdev(xs);
  const r = correlation(xs, ys);
  return {
    correlation: Number.isFinite(r) ? r : 0,
    beta: sx > 0 ? (r * stdev(ys)) / sx : 0,
    days: n,
    points: xs.map((x, i) => ({ x, y: ys[i] ?? 0, date: days[i] ?? '' })),
  };
}

/** The most and least correlated off-diagonal pairs, for the summary. */
export function extremes(series: readonly ReturnSeries[], matrix: readonly number[][]) {
  let hi = { r: -Infinity, a: '', b: '' };
  let lo = { r: Infinity, a: '', b: '' };
  const offDiagonal: number[] = [];
  series.forEach((sa, i) =>
    series.forEach((sb, j) => {
      if (j <= i) return;
      const r = matrix[i]?.[j] ?? 0;
      offDiagonal.push(r);
      if (r > hi.r) hi = { r, a: sa.label, b: sb.label };
      if (r < lo.r) lo = { r, a: sa.label, b: sb.label };
    }),
  );
  return { hi, lo, average: offDiagonal.length ? mean(offDiagonal) : 0 };
}

export function summarizeMatrix(
  series: readonly ReturnSeries[],
  matrix: readonly number[][],
  days: number,
): string {
  if (series.length < 2) return 'Not enough series to correlate.';
  const { hi, lo, average } = extremes(series, matrix);
  return `${series.length} series over ${days} days. Average correlation ${formatCorrelation(average)}. Highest ${hi.a} vs ${hi.b} ${formatCorrelation(hi.r)}, lowest ${lo.a} vs ${lo.b} ${formatCorrelation(lo.r)}.`;
}
