import {
  RANGE_DAYS,
  type NavChartPoint,
  type NavPerformanceConfig,
  type NavPerformanceData,
} from './types';

export interface NavSeries {
  points: NavChartPoint[];
  portfolioReturn: number;
  benchmarkReturn: number;
}

/** Slice to the selected range and rebase both series to 100 at the range start if asked. */
export function buildNavSeries(data: NavPerformanceData, config: NavPerformanceConfig): NavSeries {
  const days = RANGE_DAYS[config.range];
  const slice = data.points.slice(Math.max(0, data.points.length - 1 - days));
  const first = slice[0];
  const last = slice[slice.length - 1];
  if (!first || !last) return { points: [], portfolioReturn: 0, benchmarkReturn: 0 };
  const rebase = config.mode === 'rebased';
  const points = slice.map((p) => ({
    date: p.date,
    portfolio: rebase ? (p.nav / first.nav) * 100 : p.nav,
    benchmark: rebase
      ? (p.benchmark / first.benchmark) * 100
      : (p.benchmark / first.benchmark) * first.nav,
  }));
  return {
    points,
    portfolioReturn: last.nav / first.nav - 1,
    benchmarkReturn: last.benchmark / first.benchmark - 1,
  };
}
