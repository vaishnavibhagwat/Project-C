import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@/data/api';
import { getPortfolioModel } from '@/data/model';
import { holdingsResponse, HoldingsResponseSchema, mockWorld } from '@/data/mock';
import { MOCK_PORTFOLIO_ID, MockHttpError } from '@/data/mockApi';
import {
  applyRealtimeMessage,
  mockQueryKeys,
  QUERY_POLICIES,
  queryRetryDelay,
  shouldRetryQuery,
  useNewsFeed,
  usePortfolio,
  useRealTimeData,
} from '@/data/queries';
import {
  portfolioPricesUrl,
  WsSimulator,
  type MessageBuilder,
  type PricesMessage,
} from '@/data/wsSimulator';
import { widgetRegistry } from '@/registry/registry';
import { FIXTURE_TIME } from './fixtures';
import { createTestQueryClient } from './render';

const ID = MOCK_PORTFOLIO_ID;

function wrapperFor(client = createTestQueryClient()) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, wrapper: Wrapper };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('query policies', () => {
  it('poll at the default refresh rate of the widgets that read each resource', () => {
    const refresh = (id: string) => widgetRegistry.getWidget(id)?.dataSource.refreshInterval;
    expect(QUERY_POLICIES.portfolio.refetchInterval).toBe(refresh('portfolio-overview'));
    // A resource read by several widgets polls at the fastest of their rates.
    expect(QUERY_POLICIES.holdings.refetchInterval).toBe(
      Math.min(refresh('holdings-table') ?? Infinity, refresh('holdings-treemap') ?? Infinity),
    );
    expect(QUERY_POLICIES.performance.refetchInterval).toBe(refresh('nav-performance'));
    expect(QUERY_POLICIES.risk.refetchInterval).toBe(refresh('var-gauge'));
    expect(QUERY_POLICIES.marketOverview.refetchInterval).toBe(refresh('sector-heatmap'));
    expect(QUERY_POLICIES.news.refetchInterval).toBe(refresh('research-feed'));
    expect(QUERY_POLICIES.alerts.refetchInterval).toBe(refresh('alerts-monitor'));
    for (const p of Object.values(QUERY_POLICIES)) {
      // Stale-while-revalidate: cached data counts as fresh for half an interval.
      expect(p.staleTime).toBe(p.refetchInterval / 2);
    }
  });

  it('retry with exponential backoff (1, 2, 4 … 16 s), never for bad payloads or 404s', () => {
    expect([0, 1, 2, 3, 4, 5].map(queryRetryDelay)).toEqual([
      1000, 2000, 4000, 8000, 16_000, 16_000,
    ]);
    const unavailable = new MockHttpError(503, '/api/x', 'down');
    expect(shouldRetryQuery(0, unavailable)).toBe(true);
    expect(shouldRetryQuery(2, unavailable)).toBe(true);
    expect(shouldRetryQuery(3, unavailable)).toBe(false);
    expect(shouldRetryQuery(0, new MockHttpError(404, '/api/x', 'missing'))).toBe(false);
    expect(shouldRetryQuery(0, new ValidationError('bad'))).toBe(false);
  });
});

describe('data hooks', () => {
  it('a failed refresh keeps the last good data, then flags it stale after 2x the interval', async () => {
    const { wrapper } = wrapperFor();
    const { result, rerender } = renderHook(
      ({ failureRate }: { failureRate: number }) =>
        usePortfolio(ID, { latency: 'low', failureRate, retry: 0, refetchInterval: 1000 }),
      { wrapper, initialProps: { failureRate: 0 } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 10_000 });
    const good = result.current.data;
    expect(good?.portfolioId).toBe(ID);
    expect(result.current.isShowingLastGood).toBe(false);

    rerender({ failureRate: 1 });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.data).toBe(good);
    expect(result.current.isShowingLastGood).toBe(true);
    expect(result.current.error).toBeInstanceOf(MockHttpError);

    await waitFor(() => expect(result.current.isStaleData).toBe(true), { timeout: 5000 });
    expect(result.current.data).toBe(good);
  }, 20_000);

  it('keeps the previous data on screen while a new key loads (keepPreviousData)', async () => {
    const { wrapper } = wrapperFor();
    const { result, rerender } = renderHook(
      ({ limit }: { limit: number }) => useNewsFeed({ latency: 'low', failureRate: 0, limit }),
      { wrapper, initialProps: { limit: 3 } },
    );
    await waitFor(() => expect(result.current.data?.articles).toHaveLength(3), {
      timeout: 10_000,
    });
    rerender({ limit: 6 });
    expect(result.current.data?.articles).toHaveLength(3);
    expect(result.current.isPlaceholderData).toBe(true);
    await waitFor(() => expect(result.current.data?.articles).toHaveLength(6));
    expect(result.current.isPlaceholderData).toBe(false);
  }, 20_000);
});

describe('useRealTimeData', () => {
  const holdings = HoldingsResponseSchema.parse(
    JSON.parse(JSON.stringify(holdingsResponse(mockWorld(getPortfolioModel(FIXTURE_TIME))))),
  );
  const stock = holdings.holdings.find((h) => h.currency === 'INR' && h.assetClass === 'Equity');
  const newPrice = (stock?.price ?? 100) * 1.05;
  const build: MessageBuilder = ({ kind, portfolioId }) =>
    kind === 'prices'
      ? Promise.resolve({
          type: 'prices',
          portfolioId: portfolioId ?? ID,
          prices: [
            {
              ticker: stock?.ticker ?? '',
              price: newPrice,
              previousClose: stock?.price ?? 100,
              changePct: 5,
            },
          ],
        })
      : Promise.reject(new Error('not used'));

  it('merges pushed prices into the cached holdings and unsubscribes on unmount', async () => {
    vi.useFakeTimers();
    const sim = new WsSimulator({ build, latencyMs: 0 });
    const { client, wrapper } = wrapperFor();
    client.setQueryData(mockQueryKeys.holdings(ID), holdings);
    const url = portfolioPricesUrl(ID);

    const { result, unmount } = renderHook(() => useRealTimeData(url, { simulator: sim }), {
      wrapper,
    });
    expect(result.current.status.state).toBe('connected');
    expect(sim.activeChannels()).toContain(url);

    // One interval (5 s), then the zero-latency delivery timer.
    await act(() => vi.advanceTimersByTimeAsync(5050));
    expect(result.current.messageCount).toBe(1);
    expect(result.current.lastMessage?.type).toBe('prices');

    const cached = client.getQueryData<typeof holdings>(mockQueryKeys.holdings(ID));
    const row = cached?.holdings.find((h) => h.holdingId === stock?.holdingId);
    expect(row?.price).toBeCloseTo(newPrice, 3);
    expect(HoldingsResponseSchema.safeParse(cached).success).toBe(true);

    unmount();
    expect(sim.timerCount()).toBe(0);
    sim.destroy();
  });

  it('leaves the cache alone when nothing is cached or the merge would be invalid', () => {
    const { client } = wrapperFor();
    const message: PricesMessage = {
      type: 'prices',
      channel: portfolioPricesUrl(ID),
      seq: 1,
      sentAt: '2026-10-20T11:42:05+05:30',
      simulated: true,
      portfolioId: ID,
      prices: [{ ticker: stock?.ticker ?? '', price: 10, previousClose: 10, changePct: 0 }],
    };
    expect(applyRealtimeMessage(client, message)).toBe(0);

    // A cached response that no longer validates once merged (negative quantity) is skipped.
    const broken = {
      ...holdings,
      holdings: holdings.holdings.map((h) =>
        h.holdingId === stock?.holdingId ? { ...h, quantity: -1 } : h,
      ),
    };
    client.setQueryData(mockQueryKeys.holdings(ID), broken);
    expect(applyRealtimeMessage(client, message)).toBe(0);
    expect(client.getQueryData(mockQueryKeys.holdings(ID))).toBe(broken);

    client.setQueryData(mockQueryKeys.holdings(ID), holdings);
    expect(applyRealtimeMessage(client, message)).toBe(1);
  });
});
