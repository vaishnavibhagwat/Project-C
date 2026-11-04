import type { ZodType } from 'zod';
import type { LatencyProfile } from '@/types';
import { env } from '@/utils/env';
import { ApiError, ConnectionError, ValidationError } from './api';
import { isConnected } from './connection';
import { effectiveLatencyProfile, isFailureSimulated } from './controls';
import { getPortfolioModel } from './model';
import {
  alertsResponse,
  holdingsResponse,
  marketOverviewResponse,
  MOCK_PORTFOLIO_ID,
  newsResponse,
  performanceResponse,
  portfolioResponse,
  riskResponse,
} from './mock/responses';
import {
  AlertsResponseSchema,
  HoldingsResponseSchema,
  MarketOverviewResponseSchema,
  NewsResponseSchema,
  PerformanceResponseSchema,
  PortfolioResponseSchema,
  RiskResponseSchema,
  type AlertsResponse,
  type HoldingsResponse,
  type MarketOverviewResponse,
  type NewsResponse,
  type PerformanceResponse,
  type PortfolioResponse,
  type RiskResponse,
} from './mock/schemas';
import { mockWorld, type MockWorld } from './mock/world';

/**
 * REST-style mock API. Every function answers a GET in the browser (no network request):
 * it waits for the latency profile, may fail on purpose (failure rate), builds the response
 * from the shared seeded dataset, serialises it as a server would, and validates it with zod
 * before returning it. Nothing here is live market data.
 */

/** Base latency of each profile, in ms. */
export const LATENCY_PROFILE_MS: Record<LatencyProfile, number> = {
  low: 50,
  normal: 200,
  high: 500,
};

/** Latency varies by up to ±20% around the profile unless `jitter` is false. */
const JITTER = 0.2;

export { MOCK_PORTFOLIO_ID };

export interface MockRequestOptions {
  /** Default 'normal' (200 ms). */
  latency?: LatencyProfile;
  /** Add ±20% random variation to the latency (default true). */
  jitter?: boolean;
  /** Chance (0–1) that the request fails with HTTP 503. Default VITE_MOCK_ERROR_RATE. */
  failureRate?: number;
  signal?: AbortSignal;
  /** Clock (ms) for the as-of day and for hiding news not yet published. */
  now?: () => number;
  /** Random source for jitter and failures (tests pass a fixed one). */
  random?: () => number;
}

/** A simulated HTTP error (404 unknown resource, 503 injected failure). */
export class MockHttpError extends ApiError {
  constructor(
    readonly status: 404 | 503,
    readonly path: string,
    message: string,
  ) {
    super(`GET ${path} returned ${status}: ${message}`);
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Request aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Latency for one request: the profile's base, varied by up to ±20%. */
export function latencyFor(
  profile: LatencyProfile,
  jitter = true,
  random: () => number = Math.random,
): number {
  const base = LATENCY_PROFILE_MS[profile];
  return jitter ? Math.round(base * (1 + JITTER * (2 * random() - 1))) : base;
}

/** Validate a wire payload. Throws ValidationError naming the first bad field. */
export function validateMock<T>(schema: ZodType<T>, path: string, wire: unknown): T {
  const result = schema.safeParse(wire);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue ? ` at ${issue.path.join('.') || 'root'}: ${issue.message}` : '';
    throw new ValidationError(`Invalid response from GET ${path}${where}`);
  }
  return result.data;
}

async function request<T>(
  path: string,
  schema: ZodType<T>,
  build: (world: MockWorld, nowMs: number) => unknown,
  options: MockRequestOptions,
): Promise<T> {
  const random = options.random ?? Math.random;
  await wait(
    latencyFor(effectiveLatencyProfile(options.latency), options.jitter ?? true, random),
    options.signal,
  );
  if (!isConnected()) {
    throw new ConnectionError(`GET ${path} failed: data feed disconnected`);
  }
  const failureRate = options.failureRate ?? env.VITE_MOCK_ERROR_RATE;
  if (isFailureSimulated() || (failureRate > 0 && random() < failureRate)) {
    throw new MockHttpError(503, path, 'simulated upstream failure');
  }
  const nowMs = (options.now ?? Date.now)();
  const world = mockWorld(getPortfolioModel(nowMs));
  // Serialise as a server would: NaN and Infinity become null, which validation rejects.
  const wire: unknown = JSON.parse(JSON.stringify(build(world, nowMs)));
  return validateMock(schema, path, wire);
}

function portfolioPath(id: string, suffix = ''): string {
  return `/api/portfolio/${encodeURIComponent(id)}${suffix}`;
}

/** Unknown portfolio ids answer 404, like a server would. */
function forPortfolio<T>(id: string, path: string, build: (world: MockWorld) => T) {
  return (world: MockWorld): T => {
    if (id !== MOCK_PORTFOLIO_ID) throw new MockHttpError(404, path, `no portfolio "${id}"`);
    return build(world);
  };
}

/** GET /api/portfolio/:id — AUM, NAV, asset-class and geography breakdowns. */
export function getPortfolio(
  id: string,
  options: MockRequestOptions = {},
): Promise<PortfolioResponse> {
  const path = portfolioPath(id);
  return request(path, PortfolioResponseSchema, forPortfolio(id, path, portfolioResponse), options);
}

/** GET /api/portfolio/:id/holdings — every position with price, value, weight and P&L. */
export function getPortfolioHoldings(
  id: string,
  options: MockRequestOptions = {},
): Promise<HoldingsResponse> {
  const path = portfolioPath(id, '/holdings');
  return request(path, HoldingsResponseSchema, forPortfolio(id, path, holdingsResponse), options);
}

/** GET /api/portfolio/:id/performance — 3 years of daily NAV, drawdown and six benchmarks. */
export function getPortfolioPerformance(
  id: string,
  options: MockRequestOptions = {},
): Promise<PerformanceResponse> {
  const path = portfolioPath(id, '/performance');
  return request(
    path,
    PerformanceResponseSchema,
    forPortfolio(id, path, performanceResponse),
    options,
  );
}

/** GET /api/portfolio/:id/risk — VaR, volatility regime, beta, exposures. */
export function getPortfolioRisk(
  id: string,
  options: MockRequestOptions = {},
): Promise<RiskResponse> {
  const path = portfolioPath(id, '/risk');
  return request(path, RiskResponseSchema, forPortfolio(id, path, riskResponse), options);
}

/** GET /api/market/overview — six indices, breadth, top movers and sector moves. */
export function getMarketOverview(
  options: MockRequestOptions = {},
): Promise<MarketOverviewResponse> {
  return request(
    '/api/market/overview',
    MarketOverviewResponseSchema,
    marketOverviewResponse,
    options,
  );
}

/** GET /api/market/news — newest first, only items already published at `now`. */
export function getMarketNews(
  options: MockRequestOptions & { limit?: number } = {},
): Promise<NewsResponse> {
  const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 50)));
  return request(
    `/api/market/news?limit=${limit}`,
    NewsResponseSchema,
    (world, nowMs) => newsResponse(world, nowMs, limit),
    options,
  );
}

/** GET /api/market/alerts — alerts from the last `days` trading days (default 30), newest first. */
export function getMarketAlerts(
  options: MockRequestOptions & { days?: number } = {},
): Promise<AlertsResponse> {
  const days = Math.max(1, Math.min(756, Math.floor(options.days ?? 30)));
  return request(
    `/api/market/alerts?days=${days}`,
    AlertsResponseSchema,
    (world) => alertsResponse(world, days),
    options,
  );
}

/**
 * Route a GET path to the matching function, e.g. `mockGet('/api/portfolio/MER-IMAF-01/risk')`.
 * Query parameters `limit` (news) and `days` (alerts) are read from the path. Unknown paths
 * reject with a 404 MockHttpError.
 */
export function mockGet(path: string, options: MockRequestOptions = {}): Promise<unknown> {
  const url = new URL(path, 'http://mock.local');
  const parts = url.pathname.split('/').filter(Boolean);
  const number = (key: string) => {
    const raw = url.searchParams.get(key);
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const [api, area, a, b, extra] = parts;
  if (api === 'api' && area === 'portfolio' && a !== undefined && extra === undefined) {
    const id = decodeURIComponent(a);
    if (b === undefined) return getPortfolio(id, options);
    if (b === 'holdings') return getPortfolioHoldings(id, options);
    if (b === 'performance') return getPortfolioPerformance(id, options);
    if (b === 'risk') return getPortfolioRisk(id, options);
  }
  if (api === 'api' && area === 'market' && b === undefined) {
    if (a === 'overview') return getMarketOverview(options);
    if (a === 'news') return getMarketNews({ ...options, limit: number('limit') });
    if (a === 'alerts') return getMarketAlerts({ ...options, days: number('days') });
  }
  return Promise.reject(new MockHttpError(404, url.pathname, 'no such endpoint'));
}
