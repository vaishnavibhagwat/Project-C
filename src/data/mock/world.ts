import type { PortfolioModel } from '../model';
import { buildAlerts, type MockAlert } from './alerts';
import type { BenchmarkSeries } from './benchmarks';
import type { Instrument } from './instruments';
import { buildNews, type MockNewsItem } from './news';
import { windowOf, type MockWindow } from './window';

/** Everything the mock API serves, generated once per shared dataset. */
export interface MockWorld {
  window: MockWindow;
  benchmarks: BenchmarkSeries[];
  instruments: Instrument[];
  news: MockNewsItem[];
  alerts: MockAlert[];
}

const cache = new WeakMap<PortfolioModel, MockWorld>();

/**
 * The mock API's view of the portfolio model: its positions, benchmarks and NAV over the last
 * three years, plus news and alerts generated from them. Nothing here builds a second book;
 * the positions are the model's (same ids, quantities and prices). Cached per model.
 */
export function mockWorld(dataset: PortfolioModel): MockWorld {
  const hit = cache.get(dataset);
  if (hit) return hit;
  const window = windowOf(dataset);
  const slice = (series: readonly number[]) => series.slice(window.offset);
  const benchmarks = dataset.benchmarks.map((b) => ({ ...b, levels: slice(b.levels) }));
  const instruments = dataset.positions.map((p) => ({ ...p, closes: slice(p.closes) }));
  const world: MockWorld = {
    window,
    benchmarks,
    instruments,
    news: buildNews(window, instruments, benchmarks),
    alerts: buildAlerts(window, instruments),
  };
  cache.set(dataset, world);
  return world;
}
