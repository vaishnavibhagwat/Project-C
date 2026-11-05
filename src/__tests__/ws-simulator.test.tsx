import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSimulatedOutage } from '@/data/connection';
import {
  isEndpointLive,
  LIVE_HEARTBEAT_MS,
  pollInterval,
  startRealtimeBridge,
} from '@/data/realtime';
import {
  ALERTS_STREAM_URL,
  AlertsMessageSchema,
  backoffDelay,
  buildFromDataset,
  MARKET_TICKER_URL,
  NEWS_STREAM_URL,
  NewsMessageSchema,
  portfolioPricesUrl,
  PricesMessageSchema,
  TickerMessageSchema,
  WsSimulator,
  wsSimulator,
  WsSubscribeError,
  type MessageBuilder,
  type PricesMessage,
} from '@/data/wsSimulator';
import { RealtimeBanner } from '@/layout/RealtimeBanner';
import { FIXTURE_TIME } from './fixtures';

const PRICES = portfolioPricesUrl('MER-IMAF-01');

/** Cheap messages: one price, and alert/news ids from a list the test can grow. */
function testBuilder(ids: string[] = ['a1']): MessageBuilder {
  return ({ kind, portfolioId, seen }) => {
    const fresh = ids.filter((id) => !seen.has(id));
    switch (kind) {
      case 'prices':
        return Promise.resolve({
          type: 'prices',
          portfolioId: portfolioId ?? '',
          prices: [{ ticker: 'INFY', price: 1800, previousClose: 1790, changePct: 0.56 }],
        });
      case 'ticker':
        return Promise.resolve({
          type: 'ticker',
          session: 'open',
          quotes: [{ symbol: 'TCS', last: 4100, changePct: -0.2 }],
        });
      case 'alerts':
        return Promise.resolve({
          type: 'alerts',
          alerts: fresh.map((alertId) => ({
            alertId,
            type: 'risk_limit',
            severity: 'warning',
            message: `Alert ${alertId}`,
            triggeredAt: '2026-10-20T11:42:00+05:30',
            relatedWidget: 'var-gauge',
            relatedEntity: 'PORTFOLIO',
            acknowledged: false,
          })),
        });
      case 'news':
        return Promise.resolve({
          type: 'news',
          articles: fresh.map((articleId) => ({
            articleId,
            headline: `Note ${articleId}`,
            summary: 'Sample',
            source: 'Meridian Research (sample)',
            publishedAt: '2026-10-20T11:42:00+05:30',
            sentiment: 'neutral',
            sentimentScore: 0,
            relevantTickers: [],
            category: 'macro',
          })),
        });
    }
  };
}

let sim: WsSimulator;
beforeEach(() => {
  vi.useFakeTimers();
  sim = new WsSimulator({ build: testBuilder(), latencyMs: 100 });
});
afterEach(() => {
  sim.destroy();
  setSimulatedOutage(false);
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('channels and subscriptions', () => {
  it('delivers typed, validated messages at the channel interval plus latency', async () => {
    const received: PricesMessage[] = [];
    sim.subscribe(PRICES, (m) => received.push(m), { intervalMs: 2000 });
    await advance(2000);
    expect(received).toHaveLength(0); // still in flight (100 ms latency)
    await advance(100);
    expect(received).toHaveLength(1);
    expect(PricesMessageSchema.safeParse(received[0]).success).toBe(true);
    expect(received[0]).toMatchObject({ type: 'prices', channel: PRICES, seq: 1, simulated: true });
    await advance(4000);
    expect(received.map((m) => m.seq)).toEqual([1, 2, 3]);
    expect(sim.lastMessageAt()).toBeGreaterThan(0);
  });

  it('clamps frequencies to each channel range and can change them while running', async () => {
    const fn = vi.fn();
    sim.subscribe(PRICES, fn);
    expect(sim.frequencyOf(PRICES)).toBe(5000);
    expect(sim.setFrequency(PRICES, 200)).toBe(1000);
    expect(sim.setFrequency(PRICES, 60_000)).toBe(10_000);
    expect(sim.setFrequency(MARKET_TICKER_URL, 9000)).toBe(5000);
    expect(sim.setFrequency(MARKET_TICKER_URL, 500)).toBe(1000);

    sim.setFrequency(PRICES, 1000);
    await advance(3100);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('applies a new latency to later messages', async () => {
    const fn = vi.fn();
    expect(sim.setLatency(10_000)).toBe(5000);
    sim.setLatency(500);
    sim.subscribe(MARKET_TICKER_URL, fn, { intervalMs: 1000 });
    await advance(1499);
    expect(fn).not.toHaveBeenCalled();
    await advance(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(TickerMessageSchema.safeParse(fn.mock.calls[0]?.[0]).success).toBe(true);
  });

  it('shares one interval per channel and clears every timer on the last unsubscribe', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = sim.subscribe(PRICES, a, { intervalMs: 1000 });
    const offB = sim.subscribe(PRICES, b);
    const offTicker = sim.subscribe(MARKET_TICKER_URL, vi.fn());
    expect(sim.timerCount()).toBe(2);

    await advance(1000); // a message is now in flight
    expect(sim.timerCount()).toBe(3);
    offA();
    offA(); // idempotent
    await advance(100);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);

    await advance(950); // the next message is in flight
    offB();
    await advance(100);
    expect(b).toHaveBeenCalledTimes(1); // the in-flight message was dropped
    offTicker();
    expect(sim.timerCount()).toBe(0);
    expect(sim.activeChannels()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects unknown channels and portfolios', () => {
    expect(() => sim.subscribe(portfolioPricesUrl('NOPE'), vi.fn())).toThrow(WsSubscribeError);
    expect(() =>
      // @ts-expect-error not a channel URL
      sim.subscribe('ws://mock/unknown', vi.fn()),
    ).toThrow(/Unknown channel/);
  });

  it('streams only new alerts and news items', async () => {
    const ids = ['a1', 'a2'];
    sim.destroy();
    sim = new WsSimulator({ build: testBuilder(ids), latencyMs: 0 });
    const alerts = vi.fn();
    const news = vi.fn();
    sim.subscribe(ALERTS_STREAM_URL, alerts, { intervalMs: 2000 });
    sim.subscribe(NEWS_STREAM_URL, news, { intervalMs: 2000 });
    await advance(2000);
    ids.push('a3');
    await advance(2000);
    await advance(2000);
    await advance(1); // the last message is delivered just after its tick
    const alertIds = alerts.mock.calls.map((c) =>
      AlertsMessageSchema.parse(c[0]).alerts.map((a) => a.alertId),
    );
    expect(alertIds).toEqual([['a1', 'a2'], ['a3'], []]);
    const newsIds = news.mock.calls.map((c) =>
      NewsMessageSchema.parse(c[0]).articles.map((a) => a.articleId),
    );
    expect(newsIds).toEqual([['a1', 'a2'], ['a3'], []]);
  });

  it('drops messages that fail validation (no NaN or negative prices)', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sim.destroy();
    sim = new WsSimulator({
      latencyMs: 0,
      build: () =>
        Promise.resolve({
          type: 'prices',
          portfolioId: 'MER-IMAF-01',
          prices: [{ ticker: 'X', price: -5, previousClose: Number.NaN, changePct: 0 }],
        }),
    });
    const fn = vi.fn();
    sim.subscribe(PRICES, fn, { intervalMs: 1000 });
    await advance(1000);
    expect(fn).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith(
      expect.stringContaining('dropped an invalid message'),
      expect.anything(),
    );
  });

  it('keeps delivering to other subscribers when one throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ok = vi.fn();
    sim.subscribe(PRICES, () => {
      throw new Error('boom');
    });
    sim.subscribe(PRICES, ok);
    await advance(5100);
    expect(ok).toHaveBeenCalledTimes(1);
  });
});

describe('disconnect and reconnect', () => {
  it('backs off 1, 2, 4, 8, 16 s (capped) and resumes once the server is back', async () => {
    const fn = vi.fn();
    sim.subscribe(PRICES, fn, { intervalMs: 1000 });
    sim.simulateDisconnect(20_000);
    expect(sim.getStatus()).toMatchObject({ state: 'disconnected', reason: 'simulated' });
    expect(sim.timerCount()).toBe(1); // only the reconnect timer

    const delays: number[] = [];
    let last = Date.now();
    for (let n = 0; n < 4; n += 1) {
      const next = sim.getStatus().nextRetryAt ?? 0;
      delays.push(next - last);
      await advance(next - Date.now());
      last = next;
      expect(sim.getStatus().state).toBe('disconnected');
      expect(sim.getStatus().failedAttempts).toBe(n + 1);
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000]);
    expect(fn).not.toHaveBeenCalled();

    // Attempt 5 runs 16 s later, at 31 s, after the 20 s outage: it connects.
    expect((sim.getStatus().nextRetryAt ?? 0) - Date.now()).toBe(16_000);
    await advance(16_000);
    expect(sim.getStatus()).toMatchObject({ state: 'connected', failedAttempts: 0 });
    await advance(1100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps retrying every 16 s during a long outage', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(backoffDelay)).toEqual([
      1000, 2000, 4000, 8000, 16_000, 16_000, 16_000,
    ]);
  });

  it('stops in-flight messages on disconnect and reconnects at once on retryNow', async () => {
    const fn = vi.fn();
    sim.subscribe(PRICES, fn, { intervalMs: 1000 });
    await advance(1000); // in flight
    sim.simulateDisconnect(Number.POSITIVE_INFINITY);
    await advance(200);
    expect(fn).not.toHaveBeenCalled();
    expect(sim.isServerDown()).toBe(true);

    sim.retryNow();
    expect(sim.getStatus().state).toBe('disconnected'); // still down
    sim.restore();
    sim.retryNow();
    expect(sim.getStatus().state).toBe('connected');
    await advance(1100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('follows the global feed outage switch', () => {
    sim.subscribe(PRICES, vi.fn());
    setSimulatedOutage(true);
    expect(sim.getStatus()).toMatchObject({ state: 'disconnected', reason: 'network' });
    setSimulatedOutage(false);
    expect(sim.getStatus().state).toBe('connected');
  });

  it('goes idle with no timers when the last subscriber leaves during an outage', () => {
    const off = sim.subscribe(PRICES, vi.fn());
    sim.simulateDisconnect(Number.POSITIVE_INFINITY);
    off();
    expect(sim.timerCount()).toBe(0);
    expect(sim.getStatus().state).toBe('connected');
    // Subscribing again while the server is still down disconnects and retries.
    sim.subscribe(PRICES, vi.fn());
    expect(sim.getStatus().state).toBe('disconnected');
    expect(sim.timerCount()).toBe(1);
  });

  it('destroy clears every interval and timeout', async () => {
    sim.subscribe(PRICES, vi.fn(), { intervalMs: 1000 });
    sim.subscribe(MARKET_TICKER_URL, vi.fn(), { intervalMs: 1000 });
    await advance(1000);
    sim.destroy();
    expect(sim.timerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('realtime bridge', () => {
  it('pushes endpoints on messages, marks them live, and falls back when disconnected', async () => {
    const onPush = vi.fn();
    const stop = startRealtimeBridge(onPush, sim);
    expect(sim.activeChannels()).toHaveLength(4);
    expect(isEndpointLive('portfolio/holdings')).toBe(true);
    expect(isEndpointLive('alerts/active')).toBe(true);
    expect(isEndpointLive('risk/var')).toBe(false); // no channel feeds it

    await advance(5100);
    expect(onPush).toHaveBeenCalledWith([
      'portfolio/holdings',
      'portfolio/summary',
      'portfolio/allocation',
    ]);
    expect(onPush).toHaveBeenCalledWith(['market/sector-returns', 'market/ticker']);

    sim.simulateDisconnect();
    expect(isEndpointLive('portfolio/holdings')).toBe(false);
    stop();
    expect(sim.timerCount()).toBe(0);
    expect(sim.activeChannels()).toEqual([]);
  });

  it('polls at the refresh interval when not live and as a slow heartbeat when live', () => {
    expect(pollInterval(5000, false)).toBe(5000);
    expect(pollInterval(5000, true)).toBe(LIVE_HEARTBEAT_MS);
    expect(pollInterval(30_000, true)).toBe(120_000);
  });
});

describe('RealtimeBanner', () => {
  afterEach(() => {
    wsSimulator.restore();
    wsSimulator.retryNow();
    wsSimulator.destroy();
  });

  it('shows while disconnected, counts down to the next attempt and hides on reconnect', async () => {
    wsSimulator.subscribe(PRICES, vi.fn(), { intervalMs: 10_000 });
    render(<RealtimeBanner />);
    expect(screen.queryByText(/Real-time data temporarily unavailable/)).toBeNull();

    act(() => wsSimulator.simulateDisconnect(Number.POSITIVE_INFINITY));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Real-time data temporarily unavailable. Widgets are polling for updates instead. Reconnecting in 1 s (attempt 1).',
    );
    await advance(1000);
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting in 2 s (attempt 2)');

    act(() => wsSimulator.restore());
    fireEvent.click(screen.getByRole('button', { name: 'Retry now' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('dataset message builder', () => {
  it('builds valid messages for every channel from the shared dataset', async () => {
    vi.useRealTimers();
    const request = { portfolioId: 'MER-IMAF-01', nowMs: FIXTURE_TIME, seen: new Set<string>() };
    const envelope = { channel: 'c', seq: 1, sentAt: '2026-10-20T11:42:00+05:30', simulated: true };
    const prices = await buildFromDataset({ ...request, kind: 'prices' });
    expect(PricesMessageSchema.parse({ ...prices, ...envelope }).prices.length).toBeGreaterThan(30);
    const ticker = await buildFromDataset({ ...request, kind: 'ticker' });
    expect(TickerMessageSchema.parse({ ...ticker, ...envelope }).quotes).toHaveLength(50);
    const alerts = await buildFromDataset({ ...request, kind: 'alerts' });
    expect(AlertsMessageSchema.safeParse({ ...alerts, ...envelope }).success).toBe(true);
    const news = await buildFromDataset({ ...request, kind: 'news' });
    const parsed = NewsMessageSchema.parse({ ...news, ...envelope });
    expect(parsed.articles.length).toBeGreaterThan(0);
    const again = await buildFromDataset({
      ...request,
      kind: 'news',
      seen: new Set(parsed.articles.map((a) => a.articleId)),
    });
    expect(NewsMessageSchema.parse({ ...again, ...envelope }).articles).toEqual([]);
  }, 60_000);
});
