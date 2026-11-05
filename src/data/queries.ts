import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ZodType } from 'zod';
import { useNow } from '@/hooks/useNow';
import type { LatencyProfile } from '@/types';
import { env } from '@/utils/env';
import { isStale } from '@/utils/time';
import { ValidationError } from './api';
import { getDataControls, isLiveUpdatesPaused, subscribeDataControls } from './controls';
import {
  AlertsResponseSchema,
  HoldingsResponseSchema,
  MarketOverviewResponseSchema,
  NewsResponseSchema,
  type AlertsResponse,
  type HoldingsResponse,
  type MarketOverviewResponse,
  type NewsResponse,
  type PerformanceResponse,
  type PortfolioResponse,
  type RiskResponse,
} from './mock/schemas';
import {
  getMarketAlerts,
  getMarketNews,
  getMarketOverview,
  getPortfolio,
  getPortfolioHoldings,
  getPortfolioPerformance,
  getPortfolioRisk,
  MockHttpError,
  type MockRequestOptions,
} from './mockApi';
import { mergeAlerts, mergeNews, mergePrices, mergeTicker } from './transformers';
import {
  wsSimulator,
  type ChannelUrl,
  type MessageFor,
  type WsMessage,
  type WsSimulator,
  type WsStatus,
} from './wsSimulator';

/**
 * TanStack Query hooks over the REST-style mock API (src/data/mockApi.ts), and
 * `useRealTimeData`, which folds simulated WebSocket messages into the same cache.
 *
 * Every hook:
 * - polls at its widget's refresh rate and treats data as fresh for half of it, so cached data
 *   renders at once and is revalidated in the background (stale-while-revalidate);
 * - retries transient failures with exponential backoff (1 s, 2 s, 4 s), never validation
 *   errors or 404s;
 * - keeps the previous data while a new key loads and after a failed refresh, and reports
 *   `isShowingLastGood` and `isStaleData` (older than 2x the refresh) for the amber border.
 */

// ---------------------------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------------------------

export interface QueryPolicy {
  /** Poll interval (ms): the default refresh rate of the widgets that read this data. */
  refetchInterval: number;
  /** Data younger than this is served without a background refetch. */
  staleTime: number;
}

const policy = (refreshMs: number): QueryPolicy => ({
  refetchInterval: refreshMs,
  staleTime: refreshMs / 2,
});

/** Per-resource refresh, matching the default `refreshInterval` of the widgets named. */
export const QUERY_POLICIES = {
  /** portfolio-overview */
  portfolio: policy(5000),
  /** holdings-table (10 s + live prices), holdings-treemap (5 s): the faster rate */
  holdings: policy(5000),
  /** nav-performance, drawdown (daily NAV) */
  performance: policy(env.VITE_DATA_REFRESH_INTERVAL),
  /** risk-metrics, var-gauge */
  risk: policy(env.VITE_DATA_REFRESH_INTERVAL),
  /** sector-heatmap */
  marketOverview: policy(15_000),
  /** research-feed */
  news: policy(env.VITE_DATA_REFRESH_INTERVAL),
  /** alerts-monitor */
  alerts: policy(15_000),
} as const satisfies Record<string, QueryPolicy>;

export type QueryResource = keyof typeof QUERY_POLICIES;

/** Retries after the first failure (so up to 4 attempts in all). */
export const QUERY_RETRY_LIMIT = 3;
export const QUERY_RETRY_BASE_MS = 1000;
export const QUERY_RETRY_MAX_MS = 16_000;

/** Delay before retry `attempt` (0-based): 1 s, 2 s, 4 s … capped at 16 s. */
export function queryRetryDelay(attempt: number): number {
  return Math.min(QUERY_RETRY_BASE_MS * 2 ** Math.max(0, attempt), QUERY_RETRY_MAX_MS);
}

/** Retry transient failures only: a bad payload or an unknown resource will not fix itself. */
export function shouldRetryQuery(
  failureCount: number,
  error: Error,
  limit: number = QUERY_RETRY_LIMIT,
): boolean {
  if (error instanceof ValidationError) return false;
  if (error instanceof MockHttpError && error.status === 404) return false;
  return failureCount < limit;
}

// ---------------------------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------------------------

const ROOT = 'mock-api';

export const mockQueryKeys = {
  all: [ROOT] as const,
  portfolio: (id: string) => [ROOT, 'portfolio', id] as const,
  holdings: (id: string) => [ROOT, 'portfolio', id, 'holdings'] as const,
  performance: (id: string) => [ROOT, 'portfolio', id, 'performance'] as const,
  risk: (id: string) => [ROOT, 'portfolio', id, 'risk'] as const,
  marketOverview: () => [ROOT, 'market', 'overview'] as const,
  /** Prefix of every news query (one per `limit`). */
  newsAll: () => [ROOT, 'market', 'news'] as const,
  news: (limit: number) => [ROOT, 'market', 'news', limit] as const,
  /** Prefix of every alerts query (one per `days`). */
  alertsAll: () => [ROOT, 'market', 'alerts'] as const,
  alerts: (days: number) => [ROOT, 'market', 'alerts', days] as const,
};

// ---------------------------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------------------------

export interface DataHookOptions {
  enabled?: boolean;
  /** Override the policy's poll interval (ms), e.g. from a widget's config. */
  refetchInterval?: number;
  latency?: LatencyProfile;
  /** Chance (0–1) that a request fails; default VITE_MOCK_ERROR_RATE. */
  failureRate?: number;
  /** Retries after the first failure; default 3. */
  retry?: number;
}

export type DataQueryResult<T> = UseQueryResult<T, Error> & {
  /** The poll interval in use (ms). */
  refreshInterval: number;
  /** The latest refresh failed and the data shown is the last good response. */
  isShowingLastGood: boolean;
  /** The data shown is older than 2x the refresh interval. */
  isStaleData: boolean;
};

function useMockQuery<T>(
  resource: QueryResource,
  queryKey: QueryKey,
  fetch: (options: MockRequestOptions) => Promise<T>,
  options: DataHookOptions,
): DataQueryResult<T> {
  const base = QUERY_POLICIES[resource];
  const refreshInterval = options.refetchInterval ?? base.refetchInterval;
  const retryLimit = options.retry ?? QUERY_RETRY_LIMIT;
  const { paused } = useSyncExternalStore(subscribeDataControls, getDataControls, getDataControls);
  const query = useQuery<T, Error>({
    queryKey,
    queryFn: ({ signal }) =>
      fetch({ signal, latency: options.latency, failureRate: options.failureRate }),
    enabled: options.enabled ?? true,
    refetchInterval: paused ? false : refreshInterval,
    refetchIntervalInBackground: false,
    staleTime: Math.min(base.staleTime, refreshInterval / 2),
    retry: (count, error) => shouldRetryQuery(count, error, retryLimit),
    retryDelay: queryRetryDelay,
    placeholderData: keepPreviousData,
  });
  // Re-check staleness twice per interval; the flag flips within half an interval of 2x.
  const now = useNow(Math.max(1000, refreshInterval / 2));
  const hasData = query.data !== undefined;
  return {
    ...query,
    refreshInterval,
    isShowingLastGood: hasData && query.isError,
    isStaleData: hasData && isStale(query.dataUpdatedAt, refreshInterval, now),
  };
}

/** GET /api/portfolio/:id: AUM, NAV and breakdowns. Refreshes every 5 s. */
export function usePortfolio(id: string, options: DataHookOptions = {}) {
  return useMockQuery<PortfolioResponse>(
    'portfolio',
    mockQueryKeys.portfolio(id),
    (o) => getPortfolio(id, o),
    options,
  );
}

/** GET /api/portfolio/:id/holdings. Refreshes every 5 s; prices also arrive by WebSocket. */
export function useHoldings(id: string, options: DataHookOptions = {}) {
  return useMockQuery<HoldingsResponse>(
    'holdings',
    mockQueryKeys.holdings(id),
    (o) => getPortfolioHoldings(id, o),
    options,
  );
}

/** GET /api/portfolio/:id/performance: 3 years of daily NAV and benchmarks. */
export function usePerformance(id: string, options: DataHookOptions = {}) {
  return useMockQuery<PerformanceResponse>(
    'performance',
    mockQueryKeys.performance(id),
    (o) => getPortfolioPerformance(id, o),
    options,
  );
}

/** GET /api/portfolio/:id/risk: VaR, volatility, beta and exposures. */
export function useRiskMetrics(id: string, options: DataHookOptions = {}) {
  return useMockQuery<RiskResponse>(
    'risk',
    mockQueryKeys.risk(id),
    (o) => getPortfolioRisk(id, o),
    options,
  );
}

/** GET /api/market/overview. Refreshes every 15 s; constituents also arrive by WebSocket. */
export function useMarketOverview(options: DataHookOptions = {}) {
  return useMockQuery<MarketOverviewResponse>(
    'marketOverview',
    mockQueryKeys.marketOverview(),
    (o) => getMarketOverview(o),
    options,
  );
}

/** GET /api/market/news?limit=… newest first. */
export function useNewsFeed(options: DataHookOptions & { limit?: number } = {}) {
  const limit = options.limit ?? 50;
  return useMockQuery<NewsResponse>(
    'news',
    mockQueryKeys.news(limit),
    (o) => getMarketNews({ ...o, limit }),
    options,
  );
}

/** GET /api/market/alerts?days=… Refreshes every 15 s; new alerts also arrive by WebSocket. */
export function useAlerts(options: DataHookOptions & { days?: number } = {}) {
  const days = options.days ?? 30;
  return useMockQuery<AlertsResponse>(
    'alerts',
    mockQueryKeys.alerts(days),
    (o) => getMarketAlerts({ ...o, days }),
    options,
  );
}

// ---------------------------------------------------------------------------------------------
// Real time
// ---------------------------------------------------------------------------------------------

/** Merge, then validate the result like a fresh response; an invalid merge is skipped. */
function mergeChecked<T, M>(
  schema: ZodType<T>,
  merge: (current: T, message: M) => T,
  message: M,
): (current: T | undefined) => T | undefined {
  return (current) => {
    if (current === undefined) return undefined;
    const next = merge(current, message);
    if (next === current) return undefined;
    const checked = schema.safeParse(next);
    return checked.success ? checked.data : undefined;
  };
}

/**
 * Write one WebSocket message into the cached responses it affects. Only queries that already
 * hold data are updated (a message is a change to data, not a full response). Returns the
 * number of queries updated.
 */
export function applyRealtimeMessage(client: QueryClient, message: WsMessage): number {
  const update = <T, M>(key: QueryKey, schema: ZodType<T>, merge: (c: T, m: M) => T, msg: M) => {
    const next = mergeChecked(schema, merge, msg);
    let updated = 0;
    client.setQueriesData<T>({ queryKey: key }, (current) => {
      const result = next(current);
      if (result !== undefined) updated += 1;
      return result;
    });
    return updated;
  };
  switch (message.type) {
    case 'prices':
      return update(
        mockQueryKeys.holdings(message.portfolioId),
        HoldingsResponseSchema,
        mergePrices,
        message,
      );
    case 'ticker':
      return update(
        mockQueryKeys.marketOverview(),
        MarketOverviewResponseSchema,
        mergeTicker,
        message,
      );
    case 'alerts':
      return update(mockQueryKeys.alertsAll(), AlertsResponseSchema, mergeAlerts, message);
    case 'news':
      return update(mockQueryKeys.newsAll(), NewsResponseSchema, mergeNews, message);
  }
}

export interface RealTimeData<U extends ChannelUrl> {
  /** The latest message on the channel, or null before the first. */
  lastMessage: MessageFor<U> | null;
  messageCount: number;
  status: WsStatus;
}

/**
 * Subscribe to a simulated WebSocket channel and merge each message into the React Query
 * cache: prices into `useHoldings`, the ticker into `useMarketOverview`, alerts into
 * `useAlerts` and news into `useNewsFeed`. Unsubscribes on unmount or channel change.
 */
export function useRealTimeData<U extends ChannelUrl>(
  channel: U,
  { simulator = wsSimulator, enabled = true }: { simulator?: WsSimulator; enabled?: boolean } = {},
): RealTimeData<U> {
  const client = useQueryClient();
  const [state, setState] = useState<{ lastMessage: MessageFor<U> | null; messageCount: number }>({
    lastMessage: null,
    messageCount: 0,
  });
  const status = useSyncExternalStore(
    simulator.subscribeStatus,
    simulator.getStatus,
    simulator.getStatus,
  );
  useEffect(() => {
    if (!enabled) return undefined;
    setState({ lastMessage: null, messageCount: 0 });
    return simulator.subscribe(channel, (message) => {
      if (isLiveUpdatesPaused()) return;
      applyRealtimeMessage(client, message);
      setState((s) => ({ lastMessage: message, messageCount: s.messageCount + 1 }));
    });
  }, [channel, client, simulator, enabled]);
  return { ...state, status };
}
