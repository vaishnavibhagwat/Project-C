import {
  annualisedVolatility,
  beta,
  drawdownSeries,
  historicalCVaR,
  historicalVaR,
  maxDrawdown,
  sharpeRatio,
  sortinoRatio,
  trackingError,
} from '@/utils/finance';
import { getNseSession, istTimeMs, toIstIso } from '@/utils/time';
import { NIFTY50 } from '../nifty50';
import { round } from '../derive/context';
import { ALERT_VOL_WINDOW } from './alerts';
import { BENCHMARK_IDS } from './benchmarks';
import { rollingVolatility } from './gbm';
import { ASSET_CLASSES, exposureInr, GEOGRAPHIES, valueInr, type Instrument } from './instruments';
import { dailyReturns, windowCloses } from './window';
import type { MockWorld } from './world';
import type {
  AlertsResponse,
  HoldingsResponse,
  MarketOverviewResponse,
  MockHolding,
  NewsResponse,
  PerformanceResponse,
  PortfolioResponse,
  RiskResponse,
} from './schemas';

/** The one portfolio the mock API knows (same id as the dashboard's summary endpoint). */
export const MOCK_PORTFOLIO_ID = 'MER-IMAF-01';
export const MOCK_PORTFOLIO_NAME = 'Meridian India Multi-Asset Fund';

const PERIODS = [
  { period: '1M', days: 21 },
  { period: '3M', days: 63 },
  { period: '6M', days: 126 },
  { period: '1Y', days: 252 },
  { period: '3Y', days: 756 },
] as const;

/** End-of-day data is stamped at the NSE close (15:30 IST) of the as-of day. */
function asOf(world: MockWorld): string {
  return toIstIso(istTimeMs(world.window.dataset.asOfDate, 15, 30));
}

const fxOf = (world: MockWorld) => world.window.dataset.fxUsdInr;
const last = <T>(xs: readonly T[]): T | undefined => xs[xs.length - 1];
const changePct = (series: readonly number[], back = 1) => {
  const end = last(series) ?? 0;
  const start = series[series.length - 1 - back] ?? series[0] ?? end;
  return start > 0 ? (end / start - 1) * 100 : 0;
};

function fundNav(world: MockWorld): number[] {
  return world.window.dataset.fundNav.slice(world.window.offset);
}

function fundReturns(world: MockWorld): number[] {
  return world.window.dataset.fundReturns.slice(world.window.offset);
}

function totalValueInr(world: MockWorld): number {
  return world.instruments.reduce((s, i) => s + valueInr(i, fxOf(world)), 0);
}

function breakdown<K extends string>(
  world: MockWorld,
  keys: readonly K[],
  keyOf: (i: Instrument) => K,
): { key: K; valueInr: number; weightPct: number }[] {
  const total = totalValueInr(world);
  return keys.map((key) => {
    const value = world.instruments
      .filter((i) => keyOf(i) === key)
      .reduce((s, i) => s + valueInr(i, fxOf(world)), 0);
    return { key, valueInr: round(value, 2), weightPct: round((value / total) * 100, 4) };
  });
}

export function portfolioResponse(world: MockWorld): PortfolioResponse {
  const fx = fxOf(world);
  const nav = fundNav(world);
  const aumInr = totalValueInr(world);
  const dailyPnl = world.instruments.reduce(
    (s, i) => s + valueInr(i, fx) - valueInr(i, fx, i.closes.length - 2),
    0,
  );
  return {
    asOf: asOf(world),
    simulated: true,
    portfolioId: MOCK_PORTFOLIO_ID,
    name: MOCK_PORTFOLIO_NAME,
    baseCurrency: 'INR',
    aumInr: round(aumInr, 2),
    aumUsd: round(aumInr / fx, 2),
    fxUsdInr: fx,
    nav: round(last(nav) ?? 0, 4),
    navChangePct: round(changePct(nav), 4),
    dailyPnlInr: round(dailyPnl, 2),
    holdingsCount: world.instruments.length,
    benchmark: 'Nifty 50',
    assetClasses: breakdown(world, ASSET_CLASSES, (i) => i.assetClass),
    geographies: breakdown(world, GEOGRAPHIES, (i) => i.geography),
  };
}

export function holdingsResponse(world: MockWorld): HoldingsResponse {
  const fx = fxOf(world);
  const total = totalValueInr(world);
  const holdings = world.instruments.map((i): MockHolding => {
    const price = last(i.closes) ?? 0;
    const previous = i.closes[i.closes.length - 2] ?? price;
    const toInr = i.currency === 'USD' ? fx : 1;
    const value = valueInr(i, fx);
    return {
      holdingId: i.id,
      ticker: i.ticker,
      name: i.name,
      assetClass: i.assetClass,
      instrumentType: i.instrumentType,
      geography: i.geography,
      exchange: i.exchange,
      sector: i.sector,
      currency: i.currency,
      quantity: i.quantity,
      averageCost: i.averageCost,
      price: round(price, 4),
      previousClose: round(previous, 4),
      priceInr: round(price * toInr, 4),
      marketValue: round(value / toInr, 2),
      marketValueInr: round(value, 2),
      exposureInr: round(exposureInr(i, fx), 2),
      // Futures are margined: P&L is on the full notional, not on the margin carried.
      unrealisedPnlInr: round(i.quantity * (price - i.averageCost) * toInr, 2),
      dailyChangePct: round(changePct(i.closes), 4),
      dailyPnlInr: round(i.quantity * (price - previous) * toInr, 2),
      weightPct: round((value / total) * 100, 4),
    };
  });
  return {
    asOf: asOf(world),
    simulated: true,
    portfolioId: MOCK_PORTFOLIO_ID,
    totalValueInr: round(total, 2),
    holdings,
  };
}

export function performanceResponse(world: MockWorld): PerformanceResponse {
  const nav = fundNav(world);
  const dd = maxDrawdown(nav);
  const dates = world.window.dates;
  const nifty = world.benchmarks.find((b) => b.id === 'NIFTY50')?.levels ?? [];
  return {
    asOf: asOf(world),
    simulated: true,
    portfolioId: MOCK_PORTFOLIO_ID,
    dates,
    nav: nav.map((v) => round(v, 4)),
    drawdownPct: drawdownSeries(nav).map((d) => round(Math.min(0, d * 100), 4)),
    benchmarks: world.benchmarks.map((b) => ({
      id: b.id,
      name: b.name,
      currency: b.currency,
      levels: b.levels.map((v) => round(v, 2)),
      returnPct: round(changePct(b.levels, b.levels.length - 1), 4),
    })),
    periodReturns: PERIODS.map(({ period, days }) => ({
      period,
      fundPct: round(changePct(nav, days), 4),
      benchmarkPct: round(changePct(nifty, days), 4),
    })),
    maxDrawdown: {
      depthPct: round(dd.depth * 100, 4),
      peakDate: dates[dd.peakIndex] ?? dates[0] ?? '',
      troughDate: dates[dd.troughIndex] ?? dates[0] ?? '',
      recoveryDate: dd.recoveryIndex === null ? null : (dates[dd.recoveryIndex] ?? null),
    },
  };
}

/** Rolling volatility relative to its own median: calm < 0.8 ≤ normal < 1.25 ≤ elevated < 1.8. */
export function volatilityRegime(ratio: number): RiskResponse['volatilityRegime'] {
  if (ratio < 0.8) return 'calm';
  if (ratio < 1.25) return 'normal';
  if (ratio < 1.8) return 'elevated';
  return 'stressed';
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function riskResponse(world: MockWorld): RiskResponse {
  const fx = fxOf(world);
  const returns = fundReturns(world);
  const market = world.window.marketReturns;
  const rolling = rollingVolatility(returns, ALERT_VOL_WINDOW);
  const current = last(rolling) ?? 0;
  const median = medianOf(rolling);
  const aum = totalValueInr(world);
  const var95 = historicalVaR(returns, 0.95);
  const var99 = historicalVaR(returns, 0.99);
  const exposures = world.instruments.map((i) => ({ i, e: exposureInr(i, fx) }));
  const sumBy = <K extends string>(keys: readonly K[], keyOf: (i: Instrument) => K) =>
    keys.map((key) => ({
      key,
      exposureInr: round(
        exposures.filter((x) => keyOf(x.i) === key).reduce((s, x) => s + x.e, 0),
        2,
      ),
    }));
  return {
    asOf: asOf(world),
    simulated: true,
    portfolioId: MOCK_PORTFOLIO_ID,
    lookbackDays: returns.length,
    var95Pct: round(var95 * 100, 4),
    var99Pct: round(var99 * 100, 4),
    var95Inr: round(var95 * aum, 2),
    var99Inr: round(var99 * aum, 2),
    cvar95Pct: round(historicalCVaR(returns, 0.95) * 100, 4),
    volatilityPct: round(annualisedVolatility(returns) * 100, 4),
    rollingVolatilityPct: round(current * 100, 4),
    volatilityRegime: volatilityRegime(median > 0 ? current / median : 1),
    betaToNifty: round(beta(returns, market), 4),
    trackingErrorPct: round(trackingError(returns, market) * 100, 4),
    sharpe: round(sharpeRatio(returns, world.window.dataset.riskFreeRate), 4),
    sortino: round(sortinoRatio(returns, world.window.dataset.riskFreeRate), 4),
    maxDrawdownPct: round(maxDrawdown(fundNav(world)).depth * 100, 4),
    grossExposureInr: round(
      exposures.reduce((s, x) => s + Math.abs(x.e), 0),
      2,
    ),
    netExposureInr: round(
      exposures.reduce((s, x) => s + x.e, 0),
      2,
    ),
    derivativesNotionalInr: round(
      exposures
        .filter((x) => x.i.assetClass === 'Derivatives')
        .reduce((s, x) => s + Math.abs(x.e), 0),
      2,
    ),
    exposureByAssetClass: sumBy(ASSET_CLASSES, (i) => i.assetClass),
    exposureByGeography: sumBy(GEOGRAPHIES, (i) => i.geography),
  };
}

export function marketOverviewResponse(world: MockWorld, nowMs: number): MarketOverviewResponse {
  const w = world.window;
  const quotes = NIFTY50.map((c, index) => {
    const closes = windowCloses(w, index);
    return { c, last: last(closes) ?? 0, changePct: changePct(closes) };
  });
  const ranked = [...quotes].sort((a, b) => b.changePct - a.changePct);
  const mover = (q: (typeof quotes)[number]) => ({
    ticker: q.c.symbol,
    name: q.c.name,
    last: round(q.last, 2),
    changePct: round(q.changePct, 4),
  });
  const sectors = Array.from(new Set(NIFTY50.map((c) => c.sector))).map((sector) => {
    const members = quotes.filter((q) => q.c.sector === sector);
    const weight = members.reduce((s, q) => s + q.c.indexWeight, 0);
    const move = members.reduce((s, q) => s + q.changePct * q.c.indexWeight, 0) / weight;
    return { sector, changePct: round(move, 4) };
  });
  const session = getNseSession(nowMs);
  return {
    asOf: asOf(world),
    simulated: true,
    tradeDate: w.dataset.asOfDate,
    session: { phase: session.phase, label: session.label },
    fxUsdInr: fxOf(world),
    indices: BENCHMARK_IDS.map((id) => {
      const b = world.benchmarks.find((x) => x.id === id);
      const levels = b?.levels ?? [1];
      return {
        id,
        name: b?.name ?? id,
        currency: b?.currency ?? 'INR',
        last: round(last(levels) ?? 0, 2),
        previousClose: round(levels[levels.length - 2] ?? 0, 2),
        changePct: round(changePct(levels), 4),
        oneYearPct: round(changePct(levels, 252), 4),
      };
    }),
    breadth: {
      advances: quotes.filter((q) => q.changePct > 0.005).length,
      declines: quotes.filter((q) => q.changePct < -0.005).length,
      unchanged: quotes.filter((q) => Math.abs(q.changePct) <= 0.005).length,
    },
    topGainers: ranked.slice(0, 5).map(mover),
    topLosers: ranked.slice(-5).reverse().map(mover),
    sectors,
  };
}

export function newsResponse(world: MockWorld, nowMs: number, limit: number): NewsResponse {
  return {
    asOf: asOf(world),
    simulated: true,
    articles: world.news
      .filter((n) => n.publishedMs <= nowMs)
      .slice(0, limit)
      .map(({ publishedMs: _omit, ...article }) => article),
  };
}

export function alertsResponse(world: MockWorld, days: number): AlertsResponse {
  const dates = world.window.dates;
  const since = dates[Math.max(0, dates.length - days)] ?? dates[0] ?? '';
  const sinceMs = istTimeMs(since);
  const rolling = rollingVolatility(fundReturns(world), ALERT_VOL_WINDOW);
  return {
    asOf: asOf(world),
    simulated: true,
    days,
    currentVolatilityPct: round((last(rolling) ?? 0) * 100, 4),
    medianVolatilityPct: round(medianOf(rolling) * 100, 4),
    alerts: world.alerts
      .filter((a) => a.triggeredMs >= sinceMs)
      .map(({ triggeredMs: _omit, ...alert }) => alert),
  };
}

/** Daily returns of a benchmark (exported for tests and future widgets). */
export function benchmarkReturns(world: MockWorld, id: (typeof BENCHMARK_IDS)[number]): number[] {
  return dailyReturns(world.benchmarks.find((b) => b.id === id)?.levels ?? []);
}
