import { cagr } from '@/utils/finance';
import { tradingDaysEnding } from '@/utils/time';
import { NIFTY50, type Constituent } from './nifty50';
import { createRng, hashSeed, normal } from './random';

/**
 * The seeded MARKET: trading days, the Nifty 50 factor and the 50 constituents' daily closes.
 * It knows nothing about the fund. The portfolio model (src/data/model.ts) holds positions in
 * these prices and derives everything else (values, weights, NAV, risk) from them, so every
 * widget reads one set of numbers. Same seed + same as-of date => same prices.
 */

export const AUM_USD = 45_000_000_000;
export const RISK_FREE_RATE = 0.0675;
/** Five years of daily history (+1 level for the starting point). */
export const HISTORY_DAYS = 1261;
export const INCEPTION_NAV = 100;

const NORMAL_DRIFT = 0.00058;
const NORMAL_VOL = 0.0092;
export const CRASH_LENGTH = 46;
/** Base daily drift of the crash window; the model scales it to calibrate the fund drawdown. */
const CRASH_DRIFT = -0.0098;
const CRASH_VOL = 0.0075;
/** The benchmark compounds at about this rate (calibrated on normal-day drift). */
export const BENCHMARK_CAGR = 0.105;
/** Daily market moves are clipped to this band (both directions). */
const MAX_MARKET_MOVE = 0.06;

export interface MarketHistory {
  seed: number;
  asOfDate: string;
  fxUsdInr: number;
  /** YYYY-MM-DD trading days (IST), oldest first. */
  dates: string[];
  /** Nifty 50 level, starting at 100. */
  benchmarkLevels: number[];
  /** Nifty 50 daily returns (`dates.length - 1` values): the market factor. */
  benchmarkReturns: number[];
  constituents: readonly Constituent[];
  /** closes[stockIndex][dayIndex] in INR. */
  stockCloses: number[][];
  /** Index (into the factor) where the simulated crash window starts. */
  crashStartIndex: number;
}

/** Normal draws fixed for a seed and as-of date, so calibration can rebuild prices exactly. */
export interface MarketDraws {
  seed: number;
  asOfDate: string;
  dates: string[];
  market: number[];
  /** idio[stockIndex][day] */
  idio: number[][];
  crashStartIndex: number;
}

export function drawMarket(seed: number, asOfDate: string): MarketDraws {
  const rng = createRng(hashSeed(seed, 'meridian-market-v2'));
  const dates = tradingDaysEnding(asOfDate, HISTORY_DAYS);
  const days = dates.length - 1;
  return {
    seed,
    asOfDate: dates[dates.length - 1] ?? asOfDate,
    dates,
    market: Array.from({ length: days }, () => normal(rng)),
    idio: NIFTY50.map(() => Array.from({ length: days }, () => normal(rng))),
    crashStartIndex: Math.floor(days * 0.42),
  };
}

export function levelsFrom(returns: readonly number[], start: number): number[] {
  const levels = [start];
  let level = start;
  for (const r of returns) {
    level *= 1 + r;
    levels.push(level);
  }
  return levels;
}

/**
 * Market factor: drift + 0.92% x N(0,1) on normal days; a 46-day crash window with drift
 * -0.98% x `crashScale` per day. Normal-day drift is calibrated so the index compounds at about
 * BENCHMARK_CAGR.
 */
export function generateMarketFactor(draws: MarketDraws, crashScale: number): number[] {
  const start = draws.crashStartIndex;
  const build = (drift: number) =>
    draws.market.map((z, t) => {
      const inCrash = t >= start && t < start + CRASH_LENGTH;
      const r = inCrash ? CRASH_DRIFT * crashScale + CRASH_VOL * z : drift + NORMAL_VOL * z;
      return Math.max(-MAX_MARKET_MOVE, Math.min(MAX_MARKET_MOVE, r));
    });
  let drift = NORMAL_DRIFT;
  let factor = build(drift);
  for (let iter = 0; iter < 20; iter += 1) {
    const growth = cagr(levelsFrom(factor, INCEPTION_NAV));
    if (Math.abs(growth - BENCHMARK_CAGR) < 0.002) break;
    drift += (BENCHMARK_CAGR - growth) / 252;
    factor = build(drift);
  }
  return factor;
}

/**
 * Stock closes by GBM in log space: beta x ln(1 + market) + alpha - sigma^2/2 dt + sigma sqrt(dt) Z.
 * `alpha(i)` is a daily log drift for stock i (the model gives held names the manager's
 * selection alpha). Each path is rescaled so the latest close equals the anchor price.
 */
export function generateStockCloses(
  draws: MarketDraws,
  market: readonly number[],
  alpha: (stockIndex: number) => number = () => 0,
): number[][] {
  const dt = 1 / 252;
  return NIFTY50.map((c, i) => {
    const sigma = c.idioVol;
    const shocks = draws.idio[i] ?? [];
    const a = alpha(i);
    const logs: number[] = [0];
    let acc = 0;
    market.forEach((m, t) => {
      acc +=
        c.beta * Math.log(1 + m) +
        a -
        0.5 * sigma * sigma * dt +
        sigma * Math.sqrt(dt) * (shocks[t] ?? 0);
      logs.push(acc);
    });
    const last = logs[logs.length - 1] ?? 0;
    return logs.map((l) => c.anchorPrice * Math.exp(l - last));
  });
}

/** Build the market for given calibration parameters. */
export function buildMarket(
  draws: MarketDraws,
  fxUsdInr: number,
  crashScale: number,
  alpha?: (stockIndex: number) => number,
): MarketHistory {
  const benchmarkReturns = generateMarketFactor(draws, crashScale);
  return {
    seed: draws.seed,
    asOfDate: draws.asOfDate,
    fxUsdInr,
    dates: draws.dates,
    benchmarkLevels: levelsFrom(benchmarkReturns, INCEPTION_NAV),
    benchmarkReturns,
    constituents: NIFTY50,
    stockCloses: generateStockCloses(draws, benchmarkReturns, alpha),
    crashStartIndex: draws.crashStartIndex,
  };
}

export function lastClose(market: Pick<MarketHistory, 'stockCloses'>, index: number): number {
  const closes = market.stockCloses[index] ?? [];
  return closes[closes.length - 1] ?? 0;
}

export function previousClose(market: Pick<MarketHistory, 'stockCloses'>, index: number): number {
  const closes = market.stockCloses[index] ?? [];
  return closes[closes.length - 2] ?? closes[closes.length - 1] ?? 0;
}
