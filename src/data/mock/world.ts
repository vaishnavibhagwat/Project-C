import type { Dataset } from '../dataset';
import { buildAlerts, type MockAlert } from './alerts';
import { buildBenchmarks, type BenchmarkSeries } from './benchmarks';
import { buildInstruments, type Instrument } from './instruments';
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

const cache = new WeakMap<Dataset, MockWorld>();

/**
 * Generate (or reuse) the mock world for a dataset. Deterministic: the same seed and as-of
 * date give the same holdings, series, news and alerts on every machine.
 */
export function mockWorld(dataset: Dataset): MockWorld {
  const hit = cache.get(dataset);
  if (hit) return hit;
  const window = windowOf(dataset);
  const benchmarks = buildBenchmarks(window);
  const instruments = buildInstruments(window, benchmarks);
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
