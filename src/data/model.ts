import type { Sector } from '@/types';
import { env } from '@/utils/env';
import {
  annualisedVolatility,
  beta,
  cagr,
  correlationMatrix,
  historicalCVaR,
  maxDrawdown,
  sharpeRatio,
  simpleReturns,
  sortinoRatio,
  trackingError,
  valueAtRisk,
  type MaxDrawdown,
  type VarEstimate,
  type VarMethod,
} from '@/utils/finance';
import { lastCompletedTradingDay } from '@/utils/time';
import {
  AUM_USD,
  buildMarket,
  drawMarket,
  INCEPTION_NAV,
  RISK_FREE_RATE,
  type MarketHistory,
} from './dataset';
import type { MarketSnapshot } from './market';
import { buildBenchmarks, type BenchmarkSeries } from './mock/benchmarks';
import { buildInstruments, type Instrument } from './mock/instruments';
import { fullWindow } from './mock/window';
import { NIFTY50 } from './nifty50';
import { createRng, hashSeed, normal } from './random';

/**
 * THE PORTFOLIO MODEL. One seeded book from which every number in the app is derived:
 *
 *   positions (quantities) x prices      -> market values (INR)
 *   market values / total                -> weights (sum to 100%)
 *   group by sector / class / geography  -> aggregates
 *   value of the book on every past day  -> NAV per unit -> daily returns
 *   returns                              -> volatility, Sharpe, VaR, drawdown, correlation
 *   equity sleeve vs Nifty 50            -> attribution (derive/attribution.ts)
 *
 * The book totals AUM (USD 45.0B at the fixed USD/INR rate) at the last close. The market it
 * holds is calibrated so that the NAV *derived from the holdings* has one ~35% drawdown and a
 * Sharpe ratio near 0.75. Same seed + as-of date + FX => identical model on every machine.
 * Widgets (src/data/derive), the REST-style mock API (src/data/mock) and the WebSocket
 * simulator all read this object. Assumptions: docs/mock-data.md.
 */

export interface HoldingStatic {
  symbol: string;
  name: string;
  sector: Sector;
  quantity: number;
  avgCost: number;
  /** Index (into NIFTY50 / stockCloses) of this holding's constituent. */
  constituentIndex: number;
}

/** One position of the book (stock, depositary receipt, bond, derivative, fund, cash). */
export type Position = Instrument;

export interface PortfolioModel extends MarketHistory {
  aumUsd: number;
  /** AUM in INR at the last close: the book's value on the as-of date. */
  aumInr: number;
  riskFreeRate: number;
  /** The NSE-listed stocks of the book (they tick intraday). */
  holdings: HoldingStatic[];
  /** Every position, stocks first. */
  positions: Position[];
  /** Six benchmark series over the whole history. */
  benchmarks: BenchmarkSeries[];
  /** Value of the book (INR) on every day, holding today's positions. */
  bookValue: number[];
  /** NAV per unit: bookValue scaled to INCEPTION_NAV on the first day. */
  fundNav: number[];
  fundReturns: number[];
  crash: { startIndex: number; peakIndex: number; troughIndex: number };
  calibration: { crashScale: number; alpha: number; iterations: number };
}

// ---------------------------------------------------------------------------------------------
// Equity selection
// ---------------------------------------------------------------------------------------------

/** Share of AUM put into NSE-listed Nifty 50 stocks. */
export const EQUITY_SLEEVE_WEIGHT = 0.62;
/** Single-name cap inside the equity sleeve (fraction). */
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

/**
 * 42 of the 50 constituents: the 6 largest index names plus 36 of the rest (8 dropped by
 * seed). Weights are index weights tilted by exp(0.35 Z) and capped at 9.5%; quantities are
 * whole shares at the latest close (the anchor price, which does not depend on calibration).
 */
function selectHoldings(seed: number, equityBudgetInr: number): HoldingStatic[] {
  const rng = createRng(hashSeed(seed, 'meridian-holdings-v2'));
  const ranked = NIFTY50.map((c, index) => ({ c, index, key: rng() }));
  const excluded = new Set(
    ranked
      .slice(6)
      .sort((a, b) => a.key - b.key)
      .slice(0, 8)
      .map((r) => r.index),
  );
  const chosen = ranked.filter((r) => !excluded.has(r.index));
  const weights = capWeights(chosen.map((r) => r.c.indexWeight * Math.exp(0.35 * normal(rng))));
  return chosen.map((r, k) => ({
    symbol: r.c.symbol,
    name: r.c.name,
    sector: r.c.sector,
    quantity: Math.floor(((weights[k] ?? 0) * equityBudgetInr) / r.c.anchorPrice),
    avgCost: Math.round(r.c.anchorPrice * Math.exp(-0.1 + 0.18 * normal(rng)) * 100) / 100,
    constituentIndex: r.index,
  }));
}

// ---------------------------------------------------------------------------------------------
// Book value and NAV
// ---------------------------------------------------------------------------------------------

const fxFor = (p: Position, fxUsdInr: number) => (p.currency === 'USD' ? fxUsdInr : 1);

/** Book value at the last close (INR): quantity x price x FX, futures at margin. */
export function closeValueInr(p: Position, fxUsdInr: number): number {
  const price = p.closes[p.closes.length - 1] ?? 0;
  return p.quantity * price * p.valueFactor * fxFor(p, fxUsdInr);
}

/**
 * Value of the book on each day, holding today's positions: today's value minus the P&L each
 * position made since that day (futures P&L on full notional, settled through cash).
 */
export function bookValueSeries(positions: readonly Position[], fxUsdInr: number): number[] {
  const n = positions[0]?.closes.length ?? 0;
  const today = positions.reduce((s, p) => s + closeValueInr(p, fxUsdInr), 0);
  const values = new Array<number>(n).fill(today);
  for (const p of positions) {
    const last = p.closes[n - 1] ?? 0;
    const k = p.quantity * fxFor(p, fxUsdInr);
    for (let t = 0; t < n; t += 1)
      values[t] = (values[t] ?? 0) - k * (last - (p.closes[t] ?? last));
  }
  return values;
}

// ---------------------------------------------------------------------------------------------
// Building and calibration
// ---------------------------------------------------------------------------------------------

/** Calibration targets for the NAV derived from the holdings (brief: Sharpe 0.3–2.5, one 30–40% drawdown). */
export const TARGET_DRAWDOWN = 0.35;
export const TARGET_SHARPE = 0.6;
const MAX_ITERATIONS = 40;

export function buildPortfolioModel(
  seed: number,
  asOfDate: string,
  fxUsdInr: number,
): PortfolioModel {
  const draws = drawMarket(seed, asOfDate);
  const aumInr = AUM_USD * fxUsdInr;
  const holdings = selectHoldings(seed, aumInr * EQUITY_SLEEVE_WEIGHT);
  const held = new Set(holdings.map((h) => h.constituentIndex));

  let crashScale = 1.4;
  let alpha = 0;
  let iterations = 0;
  let built: Omit<PortfolioModel, 'crash' | 'calibration'> | null = null;
  for (; iterations < MAX_ITERATIONS; iterations += 1) {
    const market = buildMarket(draws, fxUsdInr, crashScale, (i) => (held.has(i) ? alpha : 0));
    const source = { ...market, aumInr, holdings };
    const window = fullWindow(source);
    const benchmarks = buildBenchmarks(window);
    const positions = buildInstruments(window, benchmarks);
    const bookValue = bookValueSeries(positions, fxUsdInr);
    const first = bookValue[0] ?? 1;
    const fundNav = bookValue.map((v) => (v / first) * INCEPTION_NAV);
    const fundReturns = simpleReturns(fundNav);
    built = {
      ...source,
      aumUsd: AUM_USD,
      riskFreeRate: RISK_FREE_RATE,
      positions,
      benchmarks,
      bookValue,
      fundNav,
      fundReturns,
    };
    const depth = maxDrawdown(fundNav).depth;
    const sharpe = sharpeRatio(fundReturns, RISK_FREE_RATE);
    const depthOk = Math.abs(depth - TARGET_DRAWDOWN) < 0.005;
    const sharpeOk = Math.abs(sharpe - TARGET_SHARPE) < 0.03;
    if (depthOk && sharpeOk) break;
    if (!depthOk) {
      crashScale = Math.min(
        4,
        Math.max(0.3, crashScale * (TARGET_DRAWDOWN / Math.max(depth, 0.01))),
      );
    }
    if (!sharpeOk) {
      // Selection alpha on the held names (log drift per day), scaled up for the sleeve's share.
      alpha +=
        ((TARGET_SHARPE - sharpe) * annualisedVolatility(fundReturns)) / 252 / EQUITY_SLEEVE_WEIGHT;
    }
  }
  if (!built) throw new Error('portfolio model did not build');
  const dd = maxDrawdown(built.fundNav);
  return {
    ...built,
    crash: {
      startIndex: built.crashStartIndex,
      peakIndex: dd.peakIndex,
      troughIndex: dd.troughIndex,
    },
    calibration: { crashScale, alpha, iterations: iterations + 1 },
  };
}

let cached: { key: string; model: PortfolioModel } | null = null;

/** The shared model for "now". Rebuilt only when the as-of trading day (or config) changes. */
export function getPortfolioModel(nowMs: number = Date.now()): PortfolioModel {
  const asOf = lastCompletedTradingDay(nowMs);
  const key = `${env.VITE_DATA_SEED}|${asOf}|${env.VITE_USD_INR_RATE}`;
  if (cached?.key !== key) {
    cached = {
      key,
      model: buildPortfolioModel(env.VITE_DATA_SEED, asOf, env.VITE_USD_INR_RATE),
    };
  }
  return cached.model;
}

// ---------------------------------------------------------------------------------------------
// Valuation (live marks), weights and aggregates
// ---------------------------------------------------------------------------------------------

export interface PositionValuation {
  position: Position;
  /** NSE constituent index for stocks that tick intraday; null otherwise. */
  constituentIndex: number | null;
  /** Price now and the close today's P&L is measured from (local currency). */
  price: number;
  previousClose: number;
  /** INR per unit of the position's currency. */
  fx: number;
  /** Value at the last close plus P&L since (futures: margin + variation margin). */
  marketValueInr: number;
  dailyPnlInr: number;
  unrealisedPnlInr: number;
  costBasisInr: number;
  /** Economic exposure (futures notional, options delta-adjusted). */
  exposureInr: number;
  /** Share of the book's market value, percent. All rows sum to 100. */
  weightPct: number;
}

/**
 * Value every position at the current marks. NSE stocks use the intraday tape while it runs;
 * everything else is held at its last close during the session (no intraday prices for bonds,
 * funds, derivatives or overseas listings), and moves from the previous close when frozen.
 */
export function valueBook(model: PortfolioModel, market: MarketSnapshot): PositionValuation[] {
  const frozen = market.mode === 'frozen';
  const indexBySymbol = new Map(model.holdings.map((h) => [h.symbol, h.constituentIndex]));
  const rows = model.positions.map((p) => {
    const n = p.closes.length;
    const last = p.closes[n - 1] ?? 0;
    const prior = p.closes[n - 2] ?? last;
    const isStock = p.instrumentType === 'Stock';
    const index = isStock ? (indexBySymbol.get(p.ticker) ?? null) : null;
    let price = last;
    let previousClose = frozen ? prior : last;
    if (index !== null && !frozen) {
      price = market.prices[index] ?? last;
      previousClose = market.referenceCloses[index] ?? last;
    }
    const fx = fxFor(p, model.fxUsdInr);
    const k = p.quantity * fx;
    return {
      position: p,
      constituentIndex: index,
      price,
      previousClose,
      fx,
      marketValueInr: closeValueInr(p, model.fxUsdInr) + k * (price - last),
      dailyPnlInr: k * (price - previousClose),
      unrealisedPnlInr: k * (price - p.averageCost),
      costBasisInr: k * p.averageCost,
      exposureInr: k * price * p.exposurePerUnit,
      weightPct: 0,
    };
  });
  const total = rows.reduce((s, r) => s + r.marketValueInr, 0);
  for (const r of rows) r.weightPct = total > 0 ? (r.marketValueInr / total) * 100 : 0;
  return rows;
}

export interface BookTotals {
  marketValueInr: number;
  previousValueInr: number;
  dailyPnlInr: number;
  dailyPnlPct: number;
  unrealisedPnlInr: number;
}

export function bookTotals(rows: readonly PositionValuation[]): BookTotals {
  const marketValueInr = rows.reduce((s, r) => s + r.marketValueInr, 0);
  const dailyPnlInr = rows.reduce((s, r) => s + r.dailyPnlInr, 0);
  const previousValueInr = marketValueInr - dailyPnlInr;
  return {
    marketValueInr,
    previousValueInr,
    dailyPnlInr,
    dailyPnlPct: previousValueInr > 0 ? (dailyPnlInr / previousValueInr) * 100 : 0,
    unrealisedPnlInr: rows.reduce((s, r) => s + r.unrealisedPnlInr, 0),
  };
}

export interface Aggregate<K extends string> {
  key: K;
  valueInr: number;
  /** Share of the rows given (percent); aggregates of the same rows sum to 100. */
  weightPct: number;
}

/** Sum market value by a key, in the order of `keys`; empty groups are kept with 0. */
export function aggregate<K extends string>(
  rows: readonly PositionValuation[],
  keys: readonly K[],
  keyOf: (row: PositionValuation) => K | null,
): Aggregate<K>[] {
  const total = rows.reduce((s, r) => s + r.marketValueInr, 0);
  return keys.map((key) => {
    const valueInr = rows.filter((r) => keyOf(r) === key).reduce((s, r) => s + r.marketValueInr, 0);
    return { key, valueInr, weightPct: total > 0 ? (valueInr / total) * 100 : 0 };
  });
}

// ---------------------------------------------------------------------------------------------
// Statistics from the derived NAV
// ---------------------------------------------------------------------------------------------

export const STATS_LOOKBACK_DAYS = 252;

export interface ModelStats {
  cagr: number;
  volatility: number;
  sharpe: number;
  sortino: number;
  drawdown: MaxDrawdown;
  /** 1-day VaR over the last 252 returns, loss fractions. */
  var: Record<VarMethod, VarEstimate>;
  cvar95: number;
  beta: number;
  trackingError: number;
  /** Correlation of daily returns over the last 252 days: fund first, then each benchmark. */
  correlation: { ids: string[]; matrix: number[][] };
}

const statsCache = new WeakMap<PortfolioModel, ModelStats>();

/** Risk and return statistics of the model's NAV (textbook formulas, src/utils/finance.ts). */
export function modelStats(model: PortfolioModel): ModelStats {
  const hit = statsCache.get(model);
  if (hit) return hit;
  const r = model.fundReturns;
  const recent = r.slice(-STATS_LOOKBACK_DAYS);
  const tail = (levels: readonly number[]) =>
    simpleReturns(levels.slice(-(STATS_LOOKBACK_DAYS + 1)));
  const stats: ModelStats = {
    cagr: cagr(model.fundNav),
    volatility: annualisedVolatility(r),
    sharpe: sharpeRatio(r, model.riskFreeRate),
    sortino: sortinoRatio(r, model.riskFreeRate),
    drawdown: maxDrawdown(model.fundNav),
    var: valueAtRisk(recent),
    cvar95: historicalCVaR(recent, 0.95),
    beta: beta(r, model.benchmarkReturns),
    trackingError: trackingError(r, model.benchmarkReturns),
    correlation: {
      ids: ['FUND', ...model.benchmarks.map((b) => b.id)],
      matrix: correlationMatrix([
        tail(model.fundNav),
        ...model.benchmarks.map((b) => tail(b.levels)),
      ]),
    },
  };
  statsCache.set(model, stats);
  return stats;
}
