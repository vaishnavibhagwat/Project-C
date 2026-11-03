import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectionError, setSimulatedOutage, ValidationError } from '@/data';
import { getDataset } from '@/data/dataset';
import {
  AlertsResponseSchema,
  HoldingsResponseSchema,
  holdingsResponse,
  MarketOverviewResponseSchema,
  mockWorld,
  NewsResponseSchema,
  PerformanceResponseSchema,
  PortfolioResponseSchema,
  RiskResponseSchema,
} from '@/data/mock';
import {
  getMarketAlerts,
  getMarketNews,
  getMarketOverview,
  getPortfolio,
  getPortfolioHoldings,
  getPortfolioPerformance,
  getPortfolioRisk,
  LATENCY_PROFILE_MS,
  latencyFor,
  MOCK_PORTFOLIO_ID,
  mockGet,
  MockHttpError,
  validateMock,
  type MockRequestOptions,
} from '@/data/mockApi';
import { FIXTURE_TIME } from './fixtures';

/** Fast, deterministic requests: low latency, no jitter, no failures, fixed clock. */
const fast: MockRequestOptions = {
  latency: 'low',
  jitter: false,
  failureRate: 0,
  now: () => FIXTURE_TIME,
};
const ID = MOCK_PORTFOLIO_ID;

afterEach(() => {
  vi.useRealTimers();
  setSimulatedOutage(false);
});

describe('mock API responses', () => {
  it.each([
    ['GET /api/portfolio/:id', () => getPortfolio(ID, fast), PortfolioResponseSchema],
    [
      'GET /api/portfolio/:id/holdings',
      () => getPortfolioHoldings(ID, fast),
      HoldingsResponseSchema,
    ],
    [
      'GET /api/portfolio/:id/performance',
      () => getPortfolioPerformance(ID, fast),
      PerformanceResponseSchema,
    ],
    ['GET /api/portfolio/:id/risk', () => getPortfolioRisk(ID, fast), RiskResponseSchema],
    ['GET /api/market/overview', () => getMarketOverview(fast), MarketOverviewResponseSchema],
    ['GET /api/market/news', () => getMarketNews(fast), NewsResponseSchema],
    ['GET /api/market/alerts', () => getMarketAlerts(fast), AlertsResponseSchema],
  ] as const)('%s returns a schema-valid simulated response', async (_name, call, schema) => {
    const data = await call();
    expect(schema.safeParse(data).success).toBe(true);
    expect(data.simulated).toBe(true);
    expect(data.asOf).toMatch(/T15:30:00\+05:30$/);
  });

  it('agrees across endpoints (one shared dataset)', async () => {
    const [portfolio, holdings, risk] = await Promise.all([
      getPortfolio(ID, fast),
      getPortfolioHoldings(ID, fast),
      getPortfolioRisk(ID, fast),
    ]);
    expect(portfolio.holdingsCount).toBe(holdings.holdings.length);
    expect(portfolio.aumInr).toBeCloseTo(holdings.totalValueInr, 0);
    expect(risk.var95Inr / ((risk.var95Pct / 100) * portfolio.aumInr)).toBeCloseTo(1, 4);
    expect(risk.var99Pct).toBeGreaterThanOrEqual(risk.var95Pct);
    expect(risk.derivativesNotionalInr).toBeGreaterThan(0);
  });

  it('limits news and alert windows from options or query parameters', async () => {
    const news = await getMarketNews({ ...fast, limit: 5 });
    expect(news.articles).toHaveLength(5);
    const viaPath = await mockGet('/api/market/news?limit=3', fast);
    expect(NewsResponseSchema.parse(viaPath).articles).toHaveLength(3);
    const week = await getMarketAlerts({ ...fast, days: 5 });
    const quarter = AlertsResponseSchema.parse(await mockGet('/api/market/alerts?days=63', fast));
    expect(week.days).toBe(5);
    expect(quarter.alerts.length).toBeGreaterThanOrEqual(week.alerts.length);
  });

  it('routes paths and answers 404 for unknown portfolios and endpoints', async () => {
    const risk = await mockGet(`/api/portfolio/${ID}/risk`, fast);
    expect(RiskResponseSchema.safeParse(risk).success).toBe(true);

    await expect(getPortfolio('NOPE', fast)).rejects.toMatchObject({ status: 404 });
    await expect(mockGet('/api/portfolio/NOPE/holdings', fast)).rejects.toBeInstanceOf(
      MockHttpError,
    );
    await expect(mockGet('/api/market/unknown', fast)).rejects.toMatchObject({ status: 404 });
    await expect(mockGet(`/api/portfolio/${ID}/risk/extra`, fast)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('latency profiles', () => {
  it('uses 50 / 200 / 500 ms, varied by at most ±20%', () => {
    expect(LATENCY_PROFILE_MS).toEqual({ low: 50, normal: 200, high: 500 });
    expect(latencyFor('normal', false)).toBe(200);
    expect(latencyFor('normal', true, () => 0)).toBe(160);
    expect(latencyFor('normal', true, () => 1)).toBe(240);
    expect(latencyFor('high', true, () => 0.5)).toBe(500);
  });

  it.each([
    ['low', 50],
    ['normal', 200],
    ['high', 500],
  ] as const)('%s waits %i ms before answering', async (latency, ms) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let settled = false;
    const pending = getPortfolio(ID, { ...fast, latency }).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(ms - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toBe(true);
  });

  it('can be aborted while waiting', async () => {
    const controller = new AbortController();
    const pending = getMarketOverview({ ...fast, latency: 'high', signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('error states', () => {
  it('fails with 503 at the configured failure rate', async () => {
    await expect(getPortfolio(ID, { ...fast, failureRate: 1 })).rejects.toMatchObject({
      status: 503,
      name: 'ApiError',
    });
    // random() below the rate fails; above it succeeds.
    await expect(
      getPortfolio(ID, { ...fast, failureRate: 0.3, random: () => 0.29 }),
    ).rejects.toBeInstanceOf(MockHttpError);
    await expect(
      getPortfolio(ID, { ...fast, failureRate: 0.3, random: () => 0.31 }),
    ).resolves.toMatchObject({ portfolioId: ID });
  });

  it('fails with a ConnectionError while the feed is disconnected', async () => {
    setSimulatedOutage(true);
    await expect(getMarketNews(fast)).rejects.toBeInstanceOf(ConnectionError);
  });
});

describe('response validation', () => {
  const valid: unknown = JSON.parse(
    JSON.stringify(holdingsResponse(mockWorld(getDataset(FIXTURE_TIME)))),
  );
  const withFirstHolding = (patch: Record<string, unknown>): unknown => {
    const parsed = HoldingsResponseSchema.parse(valid);
    const [first, ...rest] = parsed.holdings;
    return { ...parsed, holdings: [{ ...first, ...patch }, ...rest] };
  };

  it('accepts the generated holdings', () => {
    expect(validateMock(HoldingsResponseSchema, '/h', valid).holdings.length).toBeGreaterThan(40);
  });

  it.each([
    ['a negative price', { price: -1 }],
    ['a zero price', { previousClose: 0 }],
    ['NaN', { priceInr: Number.NaN }],
    ['Infinity', { marketValueInr: Number.POSITIVE_INFINITY }],
    ['NaN after JSON (null)', { dailyChangePct: null }],
  ])('rejects %s', (_label, patch) => {
    expect(() => validateMock(HoldingsResponseSchema, '/h', withFirstHolding(patch))).toThrow(
      ValidationError,
    );
  });

  it('rejects weights that do not add up and series of the wrong length', async () => {
    const parsed = HoldingsResponseSchema.parse(valid);
    const skewed = { ...parsed, holdings: parsed.holdings.slice(1) };
    expect(() => validateMock(HoldingsResponseSchema, '/h', skewed)).toThrow(/sum to 100/);
    const perf = await getPortfolioPerformance(ID, fast);
    const short = { ...perf, nav: perf.nav.slice(1) };
    expect(() => validateMock(PerformanceResponseSchema, '/p', short)).toThrow(
      /one value per date/,
    );
  });
});
