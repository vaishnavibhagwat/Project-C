import { NIFTY50 } from '../nifty50';
import { createRng, hashSeed, normal } from '../random';
import { gbmPath } from './gbm';
import { windowCloses, type MockWindow } from './window';

export const BENCHMARK_IDS = [
  'NIFTY50',
  'SENSEX',
  'SPX',
  'NIFTYBANK',
  'NIFTYIT',
  'NIFTYPHARMA',
] as const;
export type BenchmarkId = (typeof BENCHMARK_IDS)[number];

export interface BenchmarkSeries {
  id: BenchmarkId;
  name: string;
  currency: 'INR' | 'USD';
  /** Daily closing levels aligned with the window's dates. */
  levels: number[];
}

/**
 * Latest levels the simulated series end at. Round, illustrative numbers in the right range;
 * not market quotes.
 */
export const BENCHMARK_ANCHORS: Record<BenchmarkId, number> = {
  NIFTY50: 24_350,
  SENSEX: 80_100,
  SPX: 5_900,
  NIFTYBANK: 52_400,
  NIFTYIT: 41_200,
  NIFTYPHARMA: 22_150,
};

const NAMES: Record<BenchmarkId, string> = {
  NIFTY50: 'Nifty 50',
  SENSEX: 'BSE Sensex',
  SPX: 'S&P 500',
  NIFTYBANK: 'Nifty Bank',
  NIFTYIT: 'Nifty IT',
  NIFTYPHARMA: 'Nifty Pharma',
};

/** Constituents of the sector indices (subsets of the simulated Nifty 50). */
const SECTOR_BASKETS: Record<'NIFTYBANK' | 'NIFTYIT' | 'NIFTYPHARMA', readonly string[]> = {
  NIFTYBANK: ['HDFCBANK', 'ICICIBANK', 'AXISBANK', 'KOTAKBANK', 'SBIN', 'INDUSINDBK'],
  NIFTYIT: ['INFY', 'TCS', 'HCLTECH', 'TECHM', 'WIPRO'],
  NIFTYPHARMA: ['SUNPHARMA', 'CIPLA', 'DRREDDY'],
};

/** Sensex tracking error against the Nifty 50 (annualised). */
const SENSEX_TRACKING_ERROR = 0.02;

function scaleTo(levels: readonly number[], end: number): number[] {
  const last = levels[levels.length - 1] ?? 1;
  return levels.map((l) => (l / last) * end);
}

/** Index-weighted basket of constituent closes, normalised to 1 on the last day. */
function basket(w: MockWindow, symbols: readonly string[]): number[] {
  const members = symbols.flatMap((symbol) => {
    const index = NIFTY50.findIndex((c) => c.symbol === symbol);
    const c = NIFTY50[index];
    return c ? [{ weight: c.indexWeight, closes: windowCloses(w, index) }] : [];
  });
  const total = members.reduce((s, m) => s + m.weight, 0);
  return w.dates.map((_, t) =>
    members.reduce((s, m) => {
      const last = m.closes[m.closes.length - 1] ?? 1;
      return s + (m.weight / total) * ((m.closes[t] ?? last) / last);
    }, 0),
  );
}

/**
 * Six benchmark series over the window, all from the shared dataset:
 * - Nifty 50: the dataset's simulated market factor (the fund's benchmark everywhere).
 * - Sensex: the Nifty 50 plus a small tracking difference (≈2% a year).
 * - Nifty Bank / IT / Pharma: index-weighted baskets of the simulated constituents.
 * - S&P 500: its own GBM (USD) with a 0.35 beta to the Nifty factor, so global sell-offs
 *   partly line up.
 */
export function buildBenchmarks(w: MockWindow): BenchmarkSeries[] {
  const rng = createRng(hashSeed(w.dataset.seed, w.dataset.asOfDate, 'mock-benchmarks'));
  const nifty = w.dataset.benchmarkLevels.slice(w.offset);

  const teDaily = SENSEX_TRACKING_ERROR / Math.sqrt(252);
  const sensex = [1];
  for (const r of w.marketReturns) {
    const prev = sensex[sensex.length - 1] ?? 1;
    sensex.push(prev * Math.exp(Math.log(1 + r) + teDaily * normal(rng)));
  }

  const spx = gbmPath(rng, w.marketReturns.length, {
    drift: 0.1,
    volatility: 0.14,
    endPrice: BENCHMARK_ANCHORS.SPX,
    factor: w.marketReturns,
    beta: 0.35,
  });

  const levels: Record<BenchmarkId, number[]> = {
    NIFTY50: scaleTo(nifty, BENCHMARK_ANCHORS.NIFTY50),
    SENSEX: scaleTo(sensex, BENCHMARK_ANCHORS.SENSEX),
    SPX: spx,
    NIFTYBANK: scaleTo(basket(w, SECTOR_BASKETS.NIFTYBANK), BENCHMARK_ANCHORS.NIFTYBANK),
    NIFTYIT: scaleTo(basket(w, SECTOR_BASKETS.NIFTYIT), BENCHMARK_ANCHORS.NIFTYIT),
    NIFTYPHARMA: scaleTo(basket(w, SECTOR_BASKETS.NIFTYPHARMA), BENCHMARK_ANCHORS.NIFTYPHARMA),
  };
  return BENCHMARK_IDS.map((id) => ({
    id,
    name: NAMES[id],
    currency: id === 'SPX' ? 'USD' : 'INR',
    levels: levels[id],
  }));
}
