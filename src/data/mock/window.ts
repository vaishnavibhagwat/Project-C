import type { MarketHistory } from '../dataset';
import type { HoldingStatic, PortfolioModel } from '../model';

/** Three years of trading days (252 × 3); the mock API's window holds WINDOW_DAYS + 1 points. */
export const WINDOW_DAYS = 756;

/** What the book builders need: the market plus the fund's size and equity holdings. */
export interface BookSource extends MarketHistory {
  aumInr: number;
  holdings: readonly HoldingStatic[];
}

/**
 * A run of trading days over the shared market. The portfolio model builds its book over the
 * full history (offset 0); the mock API's generators work on the last three years.
 */
export interface SeriesWindow<S extends BookSource = BookSource> {
  dataset: S;
  /** Index of the window's first day in `dataset.dates`. */
  offset: number;
  /** YYYY-MM-DD trading days (IST), oldest first. */
  dates: string[];
  /** Simulated Nifty 50 daily returns inside the window (`dates.length − 1` values). */
  marketReturns: number[];
}

/** The mock API's three-year window over the portfolio model. */
export type MockWindow = SeriesWindow<PortfolioModel>;

export function windowOf<S extends BookSource>(dataset: S, days = WINDOW_DAYS): SeriesWindow<S> {
  const offset = Math.max(0, dataset.dates.length - (days + 1));
  return {
    dataset,
    offset,
    dates: dataset.dates.slice(offset),
    marketReturns: dataset.benchmarkReturns.slice(offset),
  };
}

/** The whole history (used to build the model's book). */
export function fullWindow<S extends BookSource>(dataset: S): SeriesWindow<S> {
  return windowOf(dataset, dataset.dates.length);
}

/** Closes of a Nifty 50 constituent inside the window (INR). */
export function windowCloses(w: SeriesWindow, constituentIndex: number): number[] {
  return (w.dataset.stockCloses[constituentIndex] ?? []).slice(w.offset);
}

/** Simple daily returns of a level series. */
export function dailyReturns(levels: readonly number[]): number[] {
  return levels.slice(1).map((level, t) => level / (levels[t] ?? level) - 1);
}
