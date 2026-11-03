import type { Dataset } from '../dataset';

/** Three years of trading days (252 × 3); the window holds WINDOW_DAYS + 1 daily points. */
export const WINDOW_DAYS = 756;

/**
 * The last three years of the shared dataset. Every mock generator works on this window, so
 * the NAV, benchmarks, holdings, news and alerts all describe the same days.
 */
export interface MockWindow {
  dataset: Dataset;
  /** Index of the window's first day in `dataset.dates`. */
  offset: number;
  /** YYYY-MM-DD trading days (IST), oldest first. */
  dates: string[];
  /** Simulated Nifty 50 daily returns inside the window (`dates.length − 1` values). */
  marketReturns: number[];
}

export function windowOf(dataset: Dataset): MockWindow {
  const offset = Math.max(0, dataset.dates.length - (WINDOW_DAYS + 1));
  return {
    dataset,
    offset,
    dates: dataset.dates.slice(offset),
    marketReturns: dataset.benchmarkReturns.slice(offset),
  };
}

/** Closes of a Nifty 50 constituent inside the window (INR). */
export function windowCloses(w: MockWindow, constituentIndex: number): number[] {
  return (w.dataset.stockCloses[constituentIndex] ?? []).slice(w.offset);
}

/** Simple daily returns of a level series. */
export function dailyReturns(levels: readonly number[]): number[] {
  return levels.slice(1).map((level, t) => level / (levels[t] ?? level) - 1);
}
