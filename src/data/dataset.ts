import type { Sector } from '@/types';
import { env } from '@/utils/env';
import { annualisedVolatility, cagr, maxDrawdown, sharpeRatio } from '@/utils/finance';
import { lastCompletedTradingDay, tradingDaysEnding } from '@/utils/time';
import { NIFTY50, type Constituent } from './nifty50';
import { createRng, hashSeed, normal, type Rng } from './random';

/**
 * ONE shared deterministic dataset. Every endpoint (and so every widget) derives from this
 * object, so totals and weights agree everywhere. Same seed + same as-of date => same numbers.
 */

export const AUM_USD = 45_000_000_000;
export const RISK_FREE_RATE = 0.0675;
/** Five years of daily history (+1 level for the starting point). */
export const HISTORY_DAYS = 1261;
export const INCEPTION_NAV = 100;

const NORMAL_DRIFT = 0.00058;
const NORMAL_VOL = 0.0092;
const CRASH_LENGTH = 46;
const CRASH_TARGET_DEPTH = 0.35;
/** Calibration targets: inside the brief's Sharpe band (0.3-2.5) and a plausible benchmark. */
const TARGET_SHARPE = 0.75;
const BENCHMARK_CAGR = 0.105;
/** Equity NAV daily moves are kept inside 0.1%..2% (absolute), per the brief. */
const MIN_DAILY_MOVE = 0.001;
const MAX_DAILY_MOVE = 0.02;

export interface AssetClassAllocation {
  id: 'equity' | 'debt' | 'gold' | 'reits' | 'cash';
  label: string;
  valueInr: number;
  weightPct: number;
}

export interface HoldingStatic {
  symbol: string;
  name: string;
  sector: Sector;
  quantity: number;
  avgCost: number;
  /** Index (into NIFTY50 / stockCloses) of this holding's constituent. */
  constituentIndex: number;
}

export interface Dataset {
  seed: number;
  asOfDate: string;
  fxUsdInr: number;
  aumUsd: number;
  aumInr: number;
  riskFreeRate: number;
  dates: string[];
  fundNav: number[];
  fundReturns: number[];
  benchmarkLevels: number[];
  benchmarkReturns: number[];
  constituents: readonly Constituent[];
  /** closes[stockIndex][dayIndex] in INR. */
  stockCloses: number[][];
  holdings: HoldingStatic[];
  assetClasses: AssetClassAllocation[];
  crash: { startIndex: number; peakIndex: number; troughIndex: number };
}

function clampMove(r: number): number {
  const sign = r < 0 ? -1 : 1;
  const magnitude = Math.min(MAX_DAILY_MOVE, Math.max(MIN_DAILY_MOVE, Math.abs(r)));
  return sign * magnitude;
}

function levelsFrom(returns: readonly number[], start: number): number[] {
  const levels = [start];
  let level = start;
  for (const r of returns) {
    level *= 1 + r;
    levels.push(level);
  }
  return levels;
}

function generateMarketFactor(rng: Rng, days: number, crashStart: number): number[] {
  const shocks = Array.from({ length: days }, () => normal(rng));
  const build = (drift: number) =>
    shocks.map((z, t) => {
      const inCrash = t >= crashStart && t < crashStart + CRASH_LENGTH;
      const r = inCrash ? -0.0098 + 0.0075 * z : drift + NORMAL_VOL * z;
      return Math.max(-0.06, Math.min(0.06, r));
    });
  // Calibrate normal-day drift so the benchmark compounds at roughly BENCHMARK_CAGR.
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
 * Fund returns: alpha + beta * market + noise, clamped to the 0.1%-2% daily band.
 * Two calibrations run together: the crash window is scaled so the max drawdown lands near
 * CRASH_TARGET_DEPTH, and alpha is tuned so the full-period Sharpe lands near TARGET_SHARPE.
 */
function generateFundReturns(rng: Rng, market: readonly number[], crashStart: number): number[] {
  const noise = market.map(() => 0.0032 * normal(rng));
  let alpha = 0.0002;
  let scale = 1;
  let returns: number[] = [];
  for (let iter = 0; iter < 40; iter += 1) {
    returns = market.map((m, t) => {
      const inCrash = t >= crashStart && t < crashStart + CRASH_LENGTH;
      const r = 0.9 * m + (noise[t] ?? 0);
      return clampMove(inCrash ? (r < 0 ? r * scale : r) : r + alpha);
    });
    const depth = maxDrawdown(levelsFrom(returns, INCEPTION_NAV)).depth;
    const sharpe = sharpeRatio(returns, RISK_FREE_RATE);
    const depthOk = Math.abs(depth - CRASH_TARGET_DEPTH) < 0.005;
    const sharpeOk = Math.abs(sharpe - TARGET_SHARPE) < 0.03;
    if (depthOk && sharpeOk) break;
    if (!depthOk)
      scale = Math.min(4, Math.max(0.25, scale * (CRASH_TARGET_DEPTH / Math.max(depth, 0.01))));
    if (!sharpeOk) alpha += ((TARGET_SHARPE - sharpe) * annualisedVolatility(returns)) / 252;
  }
  return returns;
}

function generateStockCloses(rng: Rng, market: readonly number[]): number[][] {
  const dt = 1 / 252;
  return NIFTY50.map((c) => {
    const sigma = c.idioVol;
    const logs: number[] = [0];
    let acc = 0;
    for (const m of market) {
      // GBM idiosyncratic component plus beta-scaled market factor (log space).
      acc +=
        c.beta * Math.log(1 + m) - 0.5 * sigma * sigma * dt + sigma * Math.sqrt(dt) * normal(rng);
      logs.push(acc);
    }
    const last = logs[logs.length - 1] ?? 0;
    // Rescale so the latest close equals the anchor price. Scaling preserves GBM returns.
    return logs.map((l) => c.anchorPrice * Math.exp(l - last));
  });
}

/** Single-name cap for the equity sleeve (fraction). */
export const MAX_SINGLE_NAME_WEIGHT = 0.095;

/** Normalise to 1 and cap each weight, redistributing the excess pro rata. */
function capWeights(raw: number[]): number[] {
  let weights = raw.map((w) => w / raw.reduce((s, v) => s + v, 0));
  for (let iter = 0; iter < 20; iter += 1) {
    const excess = weights.reduce((s, w) => s + Math.max(0, w - MAX_SINGLE_NAME_WEIGHT), 0);
    if (excess < 1e-9) break;
    const uncapped = weights.reduce((s, w) => s + (w < MAX_SINGLE_NAME_WEIGHT ? w : 0), 0);
    weights = weights.map((w) =>
      w >= MAX_SINGLE_NAME_WEIGHT ? MAX_SINGLE_NAME_WEIGHT : w + (w / uncapped) * excess,
    );
  }
  return weights;
}

function buildHoldings(rng: Rng, stockCloses: number[][], equityBudgetInr: number) {
  const ranked = NIFTY50.map((c, index) => ({ c, index, key: rng() }));
  // Keep the 6 largest index names, then drop 8 others at random: 42 holdings.
  const excluded = new Set(
    ranked
      .slice(6)
      .sort((a, b) => a.key - b.key)
      .slice(0, 8)
      .map((r) => r.index),
  );
  const chosen = ranked.filter((r) => !excluded.has(r.index));
  const weights = capWeights(chosen.map((r) => r.c.indexWeight * Math.exp(0.35 * normal(rng))));

  return chosen.map((r, k) => {
    const closes = stockCloses[r.index] ?? [];
    const lastClose = closes[closes.length - 1] ?? r.c.anchorPrice;
    const weight = weights[k] ?? 0;
    const quantity = Math.floor((weight * equityBudgetInr) / lastClose);
    const avgCost = lastClose * Math.exp(-0.1 + 0.18 * normal(rng));
    const holding: HoldingStatic = {
      symbol: r.c.symbol,
      name: r.c.name,
      sector: r.c.sector,
      quantity,
      avgCost: Math.round(avgCost * 100) / 100,
      constituentIndex: r.index,
    };
    return holding;
  });
}

function buildAssetClasses(aumInr: number, equityValueInr: number): AssetClassAllocation[] {
  const debt = aumInr * 0.24;
  const gold = aumInr * 0.05;
  const reits = aumInr * 0.03;
  // Cash absorbs share-rounding so the total is exactly AUM.
  const cash = aumInr - equityValueInr - debt - gold - reits;
  const rows: Omit<AssetClassAllocation, 'weightPct'>[] = [
    { id: 'equity', label: 'Indian Equity', valueInr: equityValueInr },
    { id: 'debt', label: 'Fixed Income', valueInr: debt },
    { id: 'gold', label: 'Gold', valueInr: gold },
    { id: 'reits', label: 'REITs & InvITs', valueInr: reits },
    { id: 'cash', label: 'Cash & Equivalents', valueInr: cash },
  ];
  return rows.map((row) => ({ ...row, weightPct: (row.valueInr / aumInr) * 100 }));
}

export function buildDataset(seed: number, asOfDate: string, fxUsdInr: number): Dataset {
  const rng = createRng(hashSeed(seed, 'meridian-dataset-v1'));
  const dates = tradingDaysEnding(asOfDate, HISTORY_DAYS);
  const days = dates.length - 1;
  const crashStart = Math.floor(days * 0.42);

  const market = generateMarketFactor(rng, days, crashStart);
  const fundReturns = generateFundReturns(rng, market, crashStart);
  const fundNav = levelsFrom(fundReturns, INCEPTION_NAV);
  const benchmarkLevels = levelsFrom(market, INCEPTION_NAV);
  const stockCloses = generateStockCloses(rng, market);

  const aumInr = AUM_USD * fxUsdInr;
  const holdings = buildHoldings(rng, stockCloses, aumInr * 0.62);
  const equityValueInr = holdings.reduce((s, h) => {
    const closes = stockCloses[h.constituentIndex] ?? [];
    return s + h.quantity * (closes[closes.length - 1] ?? 0);
  }, 0);
  const dd = maxDrawdown(fundNav);

  return {
    seed,
    asOfDate: dates[dates.length - 1] ?? asOfDate,
    fxUsdInr,
    aumUsd: AUM_USD,
    aumInr,
    riskFreeRate: RISK_FREE_RATE,
    dates,
    fundNav,
    fundReturns,
    benchmarkLevels,
    benchmarkReturns: market,
    constituents: NIFTY50,
    stockCloses,
    holdings,
    assetClasses: buildAssetClasses(aumInr, equityValueInr),
    crash: { startIndex: crashStart, peakIndex: dd.peakIndex, troughIndex: dd.troughIndex },
  };
}

let cached: { key: string; dataset: Dataset } | null = null;

/** The shared dataset for "now". Rebuilt only when the as-of trading day changes. */
export function getDataset(nowMs: number = Date.now()): Dataset {
  const asOf = lastCompletedTradingDay(nowMs);
  const key = `${env.VITE_DATA_SEED}|${asOf}|${env.VITE_USD_INR_RATE}`;
  if (cached?.key !== key) {
    cached = { key, dataset: buildDataset(env.VITE_DATA_SEED, asOf, env.VITE_USD_INR_RATE) };
  }
  return cached.dataset;
}

export function lastClose(dataset: Dataset, constituentIndex: number): number {
  const closes = dataset.stockCloses[constituentIndex] ?? [];
  return closes[closes.length - 1] ?? 0;
}

export function previousClose(dataset: Dataset, constituentIndex: number): number {
  const closes = dataset.stockCloses[constituentIndex] ?? [];
  return closes[closes.length - 2] ?? closes[closes.length - 1] ?? 0;
}
