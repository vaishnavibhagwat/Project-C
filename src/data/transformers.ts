import {
  annualisedVolatility,
  beta,
  cagr,
  correlationMatrix,
  cumulativeReturn,
  maxDrawdown,
  sharpeRatio,
  simpleReturns,
  sortinoRatio,
  trackingError,
  valueAtRisk,
  type VarEstimate,
  type VarMethod,
} from '@/utils/finance';
import { RISK_FREE_RATE } from './dataset';
import { IN_HOUSE_NEWS_SOURCE } from './derive/research';
import type {
  AlertsResponse,
  HoldingsResponse,
  MarketOverviewResponse,
  MockHolding,
  NewsResponse,
  PerformanceResponse,
  PortfolioResponse,
  RiskResponse,
} from './mock/schemas';
import { NIFTY50 } from './nifty50';
import type { AlertsData, NavHistoryData, ResearchData } from './schemas';
import type { AlertsMessage, NewsMessage, PricesMessage, TickerMessage } from './wsSimulator';

/**
 * Pure functions that turn REST-style mock API responses (src/data/mockApi.ts) into the shapes
 * widgets render, plus the merges that fold WebSocket messages into a cached response. Nothing
 * here fetches, mutates its input or reads the clock: the same input always gives the same
 * output. Merged responses are validated again by the caller (useRealTimeData) before they
 * reach the cache.
 */

/** Daily trading days used to annualise (matches src/utils/finance.ts). */
const YEAR = 252;
const round = (value: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};
const pct = (fraction: number) => fraction * 100;

// ---------------------------------------------------------------------------------------------
// Portfolio and holdings
// ---------------------------------------------------------------------------------------------

export interface AllocationSlice {
  key: string;
  valueInr: number;
  weightPct: number;
}

/** Asset-class or geography slices for a donut / bar, largest first; empty slices dropped. */
export function toAllocationSlices(
  portfolio: PortfolioResponse,
  by: 'assetClass' | 'geography',
): AllocationSlice[] {
  const rows = by === 'assetClass' ? portfolio.assetClasses : portfolio.geographies;
  return rows
    .filter((r) => r.valueInr > 0)
    .map((r) => ({ key: r.key, valueInr: r.valueInr, weightPct: r.weightPct }))
    .sort((a, b) => b.weightPct - a.weightPct);
}

export interface HoldingRow {
  id: string;
  ticker: string;
  name: string;
  assetClass: MockHolding['assetClass'];
  instrumentType: MockHolding['instrumentType'];
  geography: MockHolding['geography'];
  /** Sector, or the asset class for instruments without one (bonds, funds, derivatives). */
  group: string;
  currency: MockHolding['currency'];
  quantity: number;
  price: number;
  marketValueInr: number;
  weightPct: number;
  dailyChangePct: number;
  dailyPnlInr: number;
  unrealisedPnlInr: number;
  /** Unrealised P&L over cost, in percent; 0 when the cost is 0. */
  unrealisedPnlPct: number;
}

/** Holdings-table rows, heaviest weight first. */
export function toHoldingRows(response: HoldingsResponse): HoldingRow[] {
  return response.holdings
    .map((h) => {
      const fx = h.price > 0 ? h.priceInr / h.price : 1;
      const costInr = h.quantity * h.averageCost * fx;
      return {
        id: h.holdingId,
        ticker: h.ticker,
        name: h.name,
        assetClass: h.assetClass,
        instrumentType: h.instrumentType,
        geography: h.geography,
        group: h.sector ?? h.assetClass,
        currency: h.currency,
        quantity: h.quantity,
        price: h.price,
        marketValueInr: h.marketValueInr,
        weightPct: h.weightPct,
        dailyChangePct: h.dailyChangePct,
        dailyPnlInr: h.dailyPnlInr,
        unrealisedPnlInr: h.unrealisedPnlInr,
        unrealisedPnlPct: costInr > 0 ? round(pct(h.unrealisedPnlInr / costInr), 4) : 0,
      };
    })
    .sort((a, b) => b.weightPct - a.weightPct);
}

// ---------------------------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------------------------

export type BenchmarkId = PerformanceResponse['benchmarks'][number]['id'];

/**
 * NAV and one benchmark over the last `days` points (all by default), with the benchmark
 * rebased to the fund's NAV on the first day so both lines start together. This is the
 * nav-performance widget's shape (NavHistoryData).
 */
export function toNavHistory(
  performance: PerformanceResponse,
  benchmarkId: BenchmarkId = 'NIFTY50',
  days?: number,
): NavHistoryData {
  const n = performance.dates.length;
  const start = days === undefined ? 0 : Math.max(0, n - Math.max(2, Math.floor(days)));
  const levels = performance.benchmarks.find((b) => b.id === benchmarkId)?.levels ?? [];
  const nav0 = performance.nav[start] ?? 1;
  const bench0 = levels[start] ?? 1;
  const points = performance.dates.slice(start).map((date, k) => {
    const i = start + k;
    return {
      date,
      nav: performance.nav[i] ?? nav0,
      benchmark: round(((levels[i] ?? bench0) / bench0) * nav0, 4),
    };
  });
  return {
    asOf: performance.asOf,
    simulated: true,
    inceptionDate: performance.dates[0] ?? points[0]?.date ?? '',
    points,
  };
}

export interface DrawdownView {
  points: { date: string; drawdownPct: number }[];
  max: {
    depthPct: number;
    peakDate: string;
    troughDate: string;
    recoveryDate: string | null;
    /** Trading days from peak to trough. */
    declineDays: number;
    /** Trading days from trough back to the old peak (the recovery period); null if not yet. */
    recoveryDays: number | null;
    /** Trading days from peak to recovery; null if still under water. */
    underwaterDays: number | null;
  };
  currentDrawdownPct: number;
}

/** Underwater curve and the largest drawdown with its recovery period, from the NAV. */
export function toDrawdownView(performance: PerformanceResponse): DrawdownView {
  const { dates, nav } = performance;
  const dd = maxDrawdown(nav);
  let peak = -Infinity;
  const points = nav.map((level, i) => {
    peak = Math.max(peak, level);
    return { date: dates[i] ?? '', drawdownPct: round(pct(level / peak - 1), 4) };
  });
  return {
    points,
    max: {
      depthPct: round(pct(dd.depth), 4),
      peakDate: dates[dd.peakIndex] ?? '',
      troughDate: dates[dd.troughIndex] ?? '',
      recoveryDate: dd.recoveryIndex === null ? null : (dates[dd.recoveryIndex] ?? null),
      declineDays: dd.declinePeriods,
      recoveryDays: dd.recoveryPeriods,
      underwaterDays: dd.underwaterPeriods,
    },
    currentDrawdownPct: points[points.length - 1]?.drawdownPct ?? 0,
  };
}

export interface PerformanceStats {
  totalReturnPct: number;
  cagrPct: number;
  volatilityPct: number;
  sharpe: number;
  sortino: number;
  maxDrawdownPct: number;
  recoveryDays: number | null;
  beta: number;
  trackingErrorPct: number;
  /** 1-day VaR in percent of NAV over the last `varLookback` days. */
  var: Record<VarMethod, VarEstimate>;
  varLookbackDays: number;
}

/**
 * Risk-return statistics recomputed from the daily NAV with src/utils/finance.ts. Textbook
 * formulas on simulated data (252-day year, simple daily returns); approximations.
 */
export function toPerformanceStats(
  performance: PerformanceResponse,
  {
    riskFreeRate = RISK_FREE_RATE,
    benchmarkId = 'NIFTY50',
    varLookback = YEAR,
  }: { riskFreeRate?: number; benchmarkId?: BenchmarkId; varLookback?: number } = {},
): PerformanceStats {
  const returns = simpleReturns(performance.nav);
  const bench = simpleReturns(
    performance.benchmarks.find((b) => b.id === benchmarkId)?.levels ?? [],
  );
  const recent = returns.slice(-varLookback);
  const dd = maxDrawdown(performance.nav);
  const v = valueAtRisk(recent);
  const asPct = (e: VarEstimate): VarEstimate => ({
    var95: round(pct(e.var95), 4),
    var99: round(pct(e.var99), 4),
  });
  return {
    totalReturnPct: round(pct(cumulativeReturn(returns)), 4),
    cagrPct: round(pct(cagr(performance.nav)), 4),
    volatilityPct: round(pct(annualisedVolatility(returns)), 4),
    sharpe: round(sharpeRatio(returns, riskFreeRate), 4),
    sortino: round(sortinoRatio(returns, riskFreeRate), 4),
    maxDrawdownPct: round(pct(dd.depth), 4),
    recoveryDays: dd.recoveryPeriods,
    beta: round(beta(returns, bench), 4),
    trackingErrorPct: round(pct(trackingError(returns, bench)), 4),
    var: { historical: asPct(v.historical), parametric: asPct(v.parametric) },
    varLookbackDays: recent.length,
  };
}

export interface CorrelationView {
  ids: string[];
  labels: string[];
  /** matrix[i][j] = correlation of daily returns of ids[i] and ids[j]. */
  matrix: number[][];
}

/** Correlation of daily returns: the fund against each benchmark, over the last `days`. */
export function toCorrelationMatrix(
  performance: PerformanceResponse,
  days: number = YEAR,
): CorrelationView {
  const tail = (levels: readonly number[]) => simpleReturns(levels.slice(-(days + 1)));
  const series = [tail(performance.nav), ...performance.benchmarks.map((b) => tail(b.levels))];
  return {
    ids: ['FUND', ...performance.benchmarks.map((b) => b.id)],
    labels: ['Fund', ...performance.benchmarks.map((b) => b.name)],
    matrix: correlationMatrix(series).map((row) => row.map((rho) => round(rho, 4))),
  };
}

// ---------------------------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------------------------

export interface RiskTile {
  id: string;
  label: string;
  value: number;
  unit: 'pct' | 'ratio' | 'inr';
}

/** Headline tiles for the risk-metrics widget, in display order. */
export function toRiskTiles(risk: RiskResponse): RiskTile[] {
  return [
    { id: 'var95', label: 'VaR 95% (1-day)', value: risk.var95Pct, unit: 'pct' },
    { id: 'var99', label: 'VaR 99% (1-day)', value: risk.var99Pct, unit: 'pct' },
    { id: 'cvar95', label: 'Expected shortfall 95%', value: risk.cvar95Pct, unit: 'pct' },
    { id: 'volatility', label: 'Volatility (ann.)', value: risk.volatilityPct, unit: 'pct' },
    { id: 'beta', label: 'Beta to Nifty 50', value: risk.betaToNifty, unit: 'ratio' },
    { id: 'sharpe', label: 'Sharpe', value: risk.sharpe, unit: 'ratio' },
    { id: 'sortino', label: 'Sortino', value: risk.sortino, unit: 'ratio' },
    { id: 'maxDrawdown', label: 'Max drawdown', value: risk.maxDrawdownPct, unit: 'pct' },
    { id: 'trackingError', label: 'Tracking error', value: risk.trackingErrorPct, unit: 'pct' },
    { id: 'var95Inr', label: 'VaR 95% (INR)', value: risk.var95Inr, unit: 'inr' },
  ];
}

// ---------------------------------------------------------------------------------------------
// Market, news and alerts
// ---------------------------------------------------------------------------------------------

export interface SectorMove {
  sector: string;
  changePct: number;
}

/** Sector moves for a heat strip, best to worst. */
export function toSectorMoves(overview: MarketOverviewResponse): SectorMove[] {
  return overview.sectors
    .map((s) => ({ sector: s.sector, changePct: s.changePct }))
    .sort((a, b) => b.changePct - a.changePct);
}

/** Market news in the research-feed widget's article shape, newest first. */
export function toResearchArticles(news: NewsResponse): ResearchData['articles'] {
  return news.articles
    .map((a) => ({
      articleId: a.articleId,
      headline: a.headline,
      summary: a.summary,
      source: a.source,
      publishedAt: a.publishedAt,
      sentiment: a.sentiment,
      sentimentScore: a.sentimentScore,
      relevantTickers: a.relevantTickers,
      category: a.category,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 } as const;

/**
 * Alerts in the alerts-monitor widget's shape: unacknowledged first, then by severity, then
 * newest first. Acknowledged alerts are dropped unless `includeAcknowledged`.
 */
export function toAlertItems(
  response: AlertsResponse,
  includeAcknowledged = false,
): AlertsData['alerts'] {
  return response.alerts
    .filter((a) => includeAcknowledged || !a.acknowledged)
    .map((a) => ({
      alertId: a.alertId,
      type: a.type,
      severity: a.severity,
      message: a.message,
      triggeredAt: a.triggeredAt,
      relatedWidget: a.relatedWidget,
      relatedEntity: a.relatedEntity,
      acknowledged: a.acknowledged,
    }))
    .sort(
      (a, b) =>
        Number(a.acknowledged) - Number(b.acknowledged) ||
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        b.triggeredAt.localeCompare(a.triggeredAt),
    );
}

// ---------------------------------------------------------------------------------------------
// WebSocket merges (cached response + message -> next response)
// ---------------------------------------------------------------------------------------------

/**
 * Apply a prices message to the holdings response. Only INR-listed holdings whose ticker is in
 * the message change (ADRs, bonds and derivatives are priced elsewhere); values, P&L, the total
 * and every weight are recomputed so weights still sum to 100%.
 */
export function mergePrices(holdings: HoldingsResponse, message: PricesMessage): HoldingsResponse {
  const quotes = new Map(message.prices.map((p) => [p.ticker, p]));
  let changed = false;
  const rows = holdings.holdings.map((h) => {
    const quote = quotes.get(h.ticker);
    if (!quote || h.currency !== 'INR' || h.assetClass !== 'Equity') return h;
    changed = true;
    const value = h.quantity * quote.price;
    return {
      ...h,
      price: round(quote.price, 4),
      previousClose: round(quote.previousClose, 4),
      priceInr: round(quote.price, 4),
      marketValue: round(value, 2),
      marketValueInr: round(value, 2),
      exposureInr: round(value, 2),
      unrealisedPnlInr: round(h.quantity * (quote.price - h.averageCost), 2),
      dailyChangePct: round(quote.changePct, 4),
      dailyPnlInr: round(h.quantity * (quote.price - quote.previousClose), 2),
    };
  });
  if (!changed) return holdings;
  const total = rows.reduce((s, h) => s + h.marketValueInr, 0);
  return {
    ...holdings,
    asOf: message.sentAt,
    totalValueInr: round(total, 2),
    holdings: rows.map((h) => ({ ...h, weightPct: round(pct(h.marketValueInr / total), 4) })),
  };
}

/** Breadth band used by the overview response: moves within ±0.005% count as unchanged. */
const FLAT_PCT = 0.005;

/**
 * Apply a ticker message (every Nifty 50 constituent) to the market overview: breadth, top
 * five gainers and losers, and index-weighted sector moves are recomputed from the quotes.
 * Index levels are left as they were (the ticker carries constituents, not indices).
 */
export function mergeTicker(
  overview: MarketOverviewResponse,
  message: TickerMessage,
): MarketOverviewResponse {
  const bySymbol = new Map(message.quotes.map((q) => [q.symbol, q]));
  const quotes = NIFTY50.flatMap((c) => {
    const q = bySymbol.get(c.symbol);
    return q ? [{ c, last: q.last, changePct: q.changePct }] : [];
  });
  if (quotes.length === 0) return overview;
  const ranked = [...quotes].sort((a, b) => b.changePct - a.changePct);
  const mover = (q: (typeof quotes)[number]) => ({
    ticker: q.c.symbol,
    name: q.c.name,
    last: round(q.last, 2),
    changePct: round(q.changePct, 4),
  });
  const sectors = overview.sectors.map((s) => {
    const members = quotes.filter((q) => q.c.sector === s.sector);
    const weight = members.reduce((acc, q) => acc + q.c.indexWeight, 0);
    if (weight === 0) return s;
    const move = members.reduce((acc, q) => acc + q.changePct * q.c.indexWeight, 0) / weight;
    return { sector: s.sector, changePct: round(move, 4) };
  });
  return {
    ...overview,
    asOf: message.sentAt,
    session: { ...overview.session, phase: message.session },
    breadth: {
      advances: quotes.filter((q) => q.changePct > FLAT_PCT).length,
      declines: quotes.filter((q) => q.changePct < -FLAT_PCT).length,
      unchanged: quotes.filter((q) => Math.abs(q.changePct) <= FLAT_PCT).length,
    },
    topGainers: ranked.slice(0, 5).map(mover),
    topLosers: ranked.slice(-5).reverse().map(mover),
    sectors,
  };
}

/**
 * Add streamed alerts not already in the response, newest first. Streamed alerts carry no
 * volatility reading, so they take the response's current volatility.
 */
export function mergeAlerts(response: AlertsResponse, message: AlertsMessage): AlertsResponse {
  const known = new Set(response.alerts.map((a) => a.alertId));
  const fresh = message.alerts
    .filter((a) => !known.has(a.alertId))
    .map((a) => ({ ...a, volatilityPct: response.currentVolatilityPct }));
  if (fresh.length === 0) return response;
  return {
    ...response,
    asOf: message.sentAt,
    alerts: [...fresh, ...response.alerts].sort((a, b) =>
      b.triggeredAt.localeCompare(a.triggeredAt),
    ),
  };
}

/**
 * Add streamed articles not already in the response, newest first, keeping the response's
 * length. The stream carries in-house research notes, which have no market move attached.
 */
export function mergeNews(response: NewsResponse, message: NewsMessage): NewsResponse {
  const known = new Set(response.articles.map((a) => a.articleId));
  const fresh = message.articles
    .filter((a) => !known.has(a.articleId))
    .map((a): NewsResponse['articles'][number] => ({
      articleId: a.articleId,
      headline: a.headline,
      summary: a.summary || a.headline,
      source: IN_HOUSE_NEWS_SOURCE,
      publishedAt: a.publishedAt,
      sentiment: a.sentiment,
      sentimentScore: a.sentimentScore,
      priceMovePct: 0,
      relevantTickers: a.relevantTickers,
      category: a.category,
    }));
  if (fresh.length === 0) return response;
  const limit = Math.max(response.articles.length, 1);
  return {
    ...response,
    asOf: message.sentAt,
    articles: [...fresh, ...response.articles]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, limit),
  };
}
