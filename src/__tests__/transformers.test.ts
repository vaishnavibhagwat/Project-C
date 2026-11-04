import { describe, expect, it } from 'vitest';
import { getDataset } from '@/data/dataset';
import {
  alertsResponse,
  AlertsResponseSchema,
  holdingsResponse,
  HoldingsResponseSchema,
  marketOverviewResponse,
  MarketOverviewResponseSchema,
  mockWorld,
  newsResponse,
  NewsResponseSchema,
  performanceResponse,
  PerformanceResponseSchema,
  portfolioResponse,
  PortfolioResponseSchema,
  riskResponse,
  RiskResponseSchema,
} from '@/data/mock';
import { NavHistorySchema } from '@/data/schemas';
import {
  mergeAlerts,
  mergeNews,
  mergePrices,
  mergeTicker,
  toAlertItems,
  toAllocationSlices,
  toCorrelationMatrix,
  toDrawdownView,
  toHoldingRows,
  toNavHistory,
  toPerformanceStats,
  toResearchArticles,
  toRiskTiles,
  toSectorMoves,
} from '@/data/transformers';
import type { AlertsMessage, NewsMessage, PricesMessage, TickerMessage } from '@/data/wsSimulator';
import { maxDrawdown } from '@/utils/finance';
import { FIXTURE_TIME } from './fixtures';

/** Validated responses, exactly as the mock API returns them at the fixture time. */
const world = mockWorld(getDataset(FIXTURE_TIME));
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const portfolio = PortfolioResponseSchema.parse(wire(portfolioResponse(world)));
const holdings = HoldingsResponseSchema.parse(wire(holdingsResponse(world)));
const performance = PerformanceResponseSchema.parse(wire(performanceResponse(world)));
const risk = RiskResponseSchema.parse(wire(riskResponse(world)));
const overview = MarketOverviewResponseSchema.parse(
  wire(marketOverviewResponse(world, FIXTURE_TIME)),
);
const news = NewsResponseSchema.parse(wire(newsResponse(world, FIXTURE_TIME, 20)));
const alerts = AlertsResponseSchema.parse(wire(alertsResponse(world, 30)));

const envelope = { seq: 1, sentAt: '2026-10-20T11:42:05+05:30', simulated: true as const };

describe('transformers: raw API -> widget shapes', () => {
  it('allocation slices are largest first and still sum to 100%', () => {
    for (const by of ['assetClass', 'geography'] as const) {
      const slices = toAllocationSlices(portfolio, by);
      const weights = slices.map((s) => s.weightPct);
      expect(weights).toEqual([...weights].sort((a, b) => b - a));
      expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 1);
    }
  });

  it('holding rows are sorted by weight, grouped by sector or asset class, with P&L %', () => {
    const rows = toHoldingRows(holdings);
    expect(rows).toHaveLength(holdings.holdings.length);
    expect(rows[0]?.weightPct).toBe(Math.max(...holdings.holdings.map((h) => h.weightPct)));
    const bond = rows.find((r) => r.assetClass === 'Fixed Income');
    expect(bond?.group).toBe('Fixed Income');
    const stock = holdings.holdings.find((h) => h.currency === 'INR' && h.sector !== null);
    const row = rows.find((r) => r.id === stock?.holdingId);
    expect(row?.group).toBe(stock?.sector);
    if (stock && row) {
      const cost = stock.quantity * stock.averageCost;
      expect(row.unrealisedPnlPct).toBeCloseTo((stock.unrealisedPnlInr / cost) * 100, 3);
    }
  });

  it('NAV history rebases the benchmark to the fund and fits the nav-performance widget', () => {
    const history = toNavHistory(performance, 'SPX', 63);
    expect(NavHistorySchema.safeParse(history).success).toBe(true);
    expect(history.points).toHaveLength(63);
    expect(history.points[0]?.benchmark).toBeCloseTo(history.points[0]?.nav ?? 0, 3);
    expect(history.points.at(-1)?.date).toBe(performance.dates.at(-1));
  });

  it('drawdown view matches the API maximum drawdown and reports the recovery period', () => {
    const view = toDrawdownView(performance);
    expect(view.points).toHaveLength(performance.dates.length);
    expect(Math.min(...view.points.map((p) => p.drawdownPct))).toBeCloseTo(-view.max.depthPct, 3);
    expect(view.max.depthPct).toBeCloseTo(performance.maxDrawdown.depthPct, 2);
    expect(view.max.troughDate).toBe(performance.maxDrawdown.troughDate);
    expect(view.max.recoveryDate).toBe(performance.maxDrawdown.recoveryDate);
    const dd = maxDrawdown(performance.nav);
    expect(view.max.recoveryDays).toBe(dd.recoveryPeriods);
    // The seeded fund has one ~35% drawdown that recovers within the 3-year window.
    expect(view.max.depthPct).toBeGreaterThan(30);
    expect(view.max.recoveryDays).toBeGreaterThan(0);
  });

  it('performance statistics are finite and VaR 99% is at least VaR 95%', () => {
    const stats = toPerformanceStats(performance);
    for (const value of [stats.cagrPct, stats.volatilityPct, stats.sharpe, stats.beta]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(stats.varLookbackDays).toBe(252);
    for (const method of ['historical', 'parametric'] as const) {
      expect(stats.var[method].var99).toBeGreaterThanOrEqual(stats.var[method].var95);
      expect(stats.var[method].var95).toBeGreaterThan(0);
    }
    expect(stats.maxDrawdownPct).toBeCloseTo(performance.maxDrawdown.depthPct, 2);
  });

  it('correlation matrix covers the fund and six benchmarks; Sensex tracks Nifty closely', () => {
    const view = toCorrelationMatrix(performance);
    expect(view.ids).toEqual([
      'FUND',
      'NIFTY50',
      'SENSEX',
      'SPX',
      'NIFTYBANK',
      'NIFTYIT',
      'NIFTYPHARMA',
    ]);
    expect(view.matrix).toHaveLength(7);
    const nifty = view.ids.indexOf('NIFTY50');
    const sensex = view.ids.indexOf('SENSEX');
    expect(view.matrix[nifty]?.[sensex]).toBeGreaterThan(0.9);
    for (const row of view.matrix)
      for (const rho of row) expect(Math.abs(rho)).toBeLessThanOrEqual(1);
  });

  it('risk tiles, sector moves, articles and alerts come out in display order', () => {
    expect(
      toRiskTiles(risk)
        .map((t) => t.id)
        .slice(0, 2),
    ).toEqual(['var95', 'var99']);
    const moves = toSectorMoves(overview).map((s) => s.changePct);
    expect(moves).toEqual([...moves].sort((a, b) => b - a));
    const articles = toResearchArticles(news);
    expect(articles.map((a) => a.publishedAt)).toEqual(
      [...articles.map((a) => a.publishedAt)].sort().reverse(),
    );
    const items = toAlertItems(alerts);
    expect(items.every((a) => !a.acknowledged)).toBe(true);
    const rank = { critical: 0, warning: 1, info: 2 };
    const ranks = items.map((a) => rank[a.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(toAlertItems(alerts, true)).toHaveLength(alerts.alerts.length);
  });
});

describe('transformers: WebSocket merges', () => {
  const stock = holdings.holdings.find((h) => h.currency === 'INR' && h.assetClass === 'Equity');

  it('a prices message reprices the holding, recomputes weights and still validates', () => {
    if (!stock) throw new Error('fixture has no INR stock');
    const message: PricesMessage = {
      ...envelope,
      channel: 'ws://mock/portfolio/MER-IMAF-01/prices',
      type: 'prices',
      portfolioId: 'MER-IMAF-01',
      prices: [
        {
          ticker: stock.ticker,
          price: stock.price * 1.1,
          previousClose: stock.price,
          changePct: 10,
        },
      ],
    };
    const merged = mergePrices(holdings, message);
    const row = merged.holdings.find((h) => h.holdingId === stock.holdingId);
    expect(row?.price).toBeCloseTo(stock.price * 1.1, 3);
    expect(row?.marketValueInr).toBeCloseTo(stock.quantity * stock.price * 1.1, 0);
    expect(row?.dailyPnlInr).toBeCloseTo(stock.quantity * stock.price * 0.1, 0);
    expect(merged.totalValueInr).toBeGreaterThan(holdings.totalValueInr);
    expect(HoldingsResponseSchema.safeParse(merged).success).toBe(true);
    // Pure: the cached input is untouched.
    expect(holdings.holdings.find((h) => h.holdingId === stock.holdingId)?.price).toBe(stock.price);
  });

  it('a prices message for unknown tickers returns the same object (no cache write)', () => {
    const message: PricesMessage = {
      ...envelope,
      channel: 'ws://mock/portfolio/MER-IMAF-01/prices',
      type: 'prices',
      portfolioId: 'MER-IMAF-01',
      prices: [{ ticker: 'NOPE', price: 1, previousClose: 1, changePct: 0 }],
    };
    expect(mergePrices(holdings, message)).toBe(holdings);
  });

  it('a ticker message recomputes breadth and movers from the constituents', () => {
    const message: TickerMessage = {
      ...envelope,
      channel: 'ws://mock/market/ticker',
      type: 'ticker',
      session: 'open',
      quotes: [
        { symbol: 'RELIANCE', last: 3000, changePct: 9 },
        { symbol: 'TCS', last: 4000, changePct: -7 },
        { symbol: 'INFY', last: 1800, changePct: 0 },
      ],
    };
    const merged = mergeTicker(overview, message);
    expect(merged.breadth).toEqual({ advances: 1, declines: 1, unchanged: 1 });
    expect(merged.topGainers[0]?.ticker).toBe('RELIANCE');
    expect(merged.topLosers[0]?.ticker).toBe('TCS');
    expect(merged.session.phase).toBe('open');
    expect(MarketOverviewResponseSchema.safeParse(merged).success).toBe(true);
  });

  it('alert and news messages add only new items, newest first', () => {
    const alertMessage: AlertsMessage = {
      ...envelope,
      channel: 'ws://mock/alerts/stream',
      type: 'alerts',
      alerts: [
        {
          alertId: 'WS-1',
          type: 'risk_limit',
          severity: 'critical',
          message: 'VaR limit breached',
          triggeredAt: '2026-10-20T11:42:04+05:30',
          relatedWidget: 'var-gauge',
          relatedEntity: 'PORTFOLIO',
          acknowledged: false,
        },
      ],
    };
    const withAlert = mergeAlerts(alerts, alertMessage);
    expect(withAlert.alerts[0]?.alertId).toBe('WS-1');
    expect(withAlert.alerts[0]?.volatilityPct).toBe(alerts.currentVolatilityPct);
    expect(mergeAlerts(withAlert, alertMessage)).toBe(withAlert);
    expect(AlertsResponseSchema.safeParse(withAlert).success).toBe(true);

    const newsMessage: NewsMessage = {
      ...envelope,
      channel: 'ws://mock/news/stream',
      type: 'news',
      articles: [
        {
          articleId: 'WS-N1',
          headline: 'Desk note',
          summary: '',
          source: 'Meridian Research · Desk (sample)',
          publishedAt: '2026-10-20T11:42:03+05:30',
          sentiment: 'neutral',
          sentimentScore: 0,
          relevantTickers: [],
          category: 'macro',
        },
      ],
    };
    const withNews = mergeNews(news, newsMessage);
    expect(withNews.articles).toHaveLength(news.articles.length);
    expect(withNews.articles[0]).toMatchObject({
      articleId: 'WS-N1',
      source: 'Meridian Research',
      summary: 'Desk note',
    });
    expect(NewsResponseSchema.safeParse(withNews).success).toBe(true);
  });
});
