import { z } from 'zod';
import { getNseSession, toIstIso } from '@/utils/time';
import { buildContext } from './api';
import { isConnected, subscribeConnection } from './connection';
import { getDataset, lastClose, previousClose } from './dataset';
import { liveHoldings } from './derive/context';
import { PORTFOLIO_ID } from './derive/portfolio';
import { createTradeSchedule } from './derive/trades';
import { ENDPOINTS } from './endpoints';
import { primeMarket } from './market';
import { AlertSchema, finite, istIso, NewsArticleSchema, price } from './schemas';

/**
 * Simulated WebSocket server and client in one, for the four mock channels below. Nothing
 * opens a socket: messages are built in the browser from the shared seeded dataset and the
 * intraday tape, validated with zod (as a client would validate what it receives) and
 * delivered after a configurable latency.
 *
 * - One `setInterval` per channel, shared by every subscriber. The last unsubscribe clears it,
 *   together with any message still in flight, so nothing keeps running (see `timerCount`).
 * - A simulated disconnect (or the global feed outage switch) stops every channel and starts
 *   reconnect attempts after 1 s, 2 s, 4 s, 8 s, then every 16 s. Subscriptions survive and
 *   resume when an attempt succeeds.
 */

// ---------------------------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------------------------

export type PortfolioPricesUrl = `ws://mock/portfolio/${string}/prices`;
export type MarketTickerUrl = 'ws://mock/market/ticker';
export type AlertsStreamUrl = 'ws://mock/alerts/stream';
export type NewsStreamUrl = 'ws://mock/news/stream';
export type ChannelUrl = PortfolioPricesUrl | MarketTickerUrl | AlertsStreamUrl | NewsStreamUrl;

export type ChannelKind = 'prices' | 'ticker' | 'alerts' | 'news';

export const MARKET_TICKER_URL: MarketTickerUrl = 'ws://mock/market/ticker';
export const ALERTS_STREAM_URL: AlertsStreamUrl = 'ws://mock/alerts/stream';
export const NEWS_STREAM_URL: NewsStreamUrl = 'ws://mock/news/stream';

export function portfolioPricesUrl(portfolioId: string): PortfolioPricesUrl {
  return `ws://mock/portfolio/${encodeURIComponent(portfolioId)}/prices`;
}

/** Allowed and default message intervals per channel (ms). */
export const CHANNEL_FREQUENCY: Record<ChannelKind, { min: number; max: number; default: number }> =
  {
    prices: { min: 1000, max: 10_000, default: 5000 },
    ticker: { min: 1000, max: 5000, default: 3000 },
    alerts: { min: 2000, max: 60_000, default: 10_000 },
    news: { min: 2000, max: 60_000, default: 20_000 },
  };

/** Reconnect delays: attempt 1 after 1 s, then 2, 4, 8 and 16 s (16 s from then on). */
export const BACKOFF_MS = [1000, 2000, 4000, 8000, 16_000] as const;

export function backoffDelay(failedAttempts: number): number {
  return BACKOFF_MS[Math.min(failedAttempts, BACKOFF_MS.length - 1)] ?? 16_000;
}

export const DEFAULT_LATENCY_MS = 80;
export const MAX_LATENCY_MS = 5000;
/** How long a simulated disconnect keeps the server unreachable unless restored sooner. */
export const DEFAULT_OUTAGE_MS = 20_000;

/** Thrown by `subscribe` for a malformed URL or an unknown portfolio. */
export class WsSubscribeError extends Error {
  override readonly name = 'WsSubscribeError';
}

interface ParsedChannel {
  kind: ChannelKind;
  portfolioId: string | null;
}

export function parseChannelUrl(url: string): ParsedChannel | null {
  if (url === MARKET_TICKER_URL) return { kind: 'ticker', portfolioId: null };
  if (url === ALERTS_STREAM_URL) return { kind: 'alerts', portfolioId: null };
  if (url === NEWS_STREAM_URL) return { kind: 'news', portfolioId: null };
  const match = /^ws:\/\/mock\/portfolio\/([^/]+)\/prices$/.exec(url);
  if (!match?.[1]) return null;
  try {
    return { kind: 'prices', portfolioId: decodeURIComponent(match[1]) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------------------------

const envelope = {
  channel: z.string().min(1),
  /** Per-channel sequence number, from 1. */
  seq: z.number().int().positive(),
  sentAt: istIso,
  simulated: z.literal(true),
};

export const PricesMessageSchema = z.object({
  ...envelope,
  type: z.literal('prices'),
  portfolioId: z.string().min(1),
  prices: z.array(
    z.object({ ticker: z.string().min(1), price, previousClose: price, changePct: finite }),
  ),
});

export const TickerMessageSchema = z.object({
  ...envelope,
  type: z.literal('ticker'),
  session: z.enum(['pre-open', 'open', 'closed']),
  quotes: z.array(z.object({ symbol: z.string().min(1), last: price, changePct: finite })),
});

/** New alerts since the last message (the first message carries the current set). */
export const AlertsMessageSchema = z.object({
  ...envelope,
  type: z.literal('alerts'),
  alerts: z.array(AlertSchema),
});

/** New research items since the last message (the first message carries the current set). */
export const NewsMessageSchema = z.object({
  ...envelope,
  type: z.literal('news'),
  articles: z.array(NewsArticleSchema),
});

export type PricesMessage = z.infer<typeof PricesMessageSchema>;
export type TickerMessage = z.infer<typeof TickerMessageSchema>;
export type AlertsMessage = z.infer<typeof AlertsMessageSchema>;
export type NewsMessage = z.infer<typeof NewsMessageSchema>;
export type WsMessage = PricesMessage | TickerMessage | AlertsMessage | NewsMessage;

/** The message type a channel URL delivers. */
export type MessageFor<U extends ChannelUrl> = U extends MarketTickerUrl
  ? TickerMessage
  : U extends AlertsStreamUrl
    ? AlertsMessage
    : U extends NewsStreamUrl
      ? NewsMessage
      : PricesMessage;

const SCHEMAS = {
  prices: PricesMessageSchema,
  ticker: TickerMessageSchema,
  alerts: AlertsMessageSchema,
  news: NewsMessageSchema,
} as const;

/** What a channel produces on one tick, before the envelope is added. */
export type MessageBody =
  | Omit<PricesMessage, keyof typeof envelope>
  | Omit<TickerMessage, keyof typeof envelope>
  | Omit<AlertsMessage, keyof typeof envelope>
  | Omit<NewsMessage, keyof typeof envelope>;

export interface BuildRequest {
  kind: ChannelKind;
  portfolioId: string | null;
  nowMs: number;
  /** Ids already sent on this channel (alerts and news only send new items). */
  seen: ReadonlySet<string>;
}

export type MessageBuilder = (request: BuildRequest) => Promise<MessageBody>;

const pctChange = (last: number, prev: number) => (prev > 0 ? (last / prev - 1) * 100 : 0);

/** Builds messages from the shared dataset and the intraday tape (the same prices as the API). */
export const buildFromDataset: MessageBuilder = async ({ kind, portfolioId, nowMs, seen }) => {
  const dataset = getDataset(nowMs);
  await primeMarket(dataset, nowMs, createTradeSchedule(dataset));
  const ctx = buildContext(nowMs);
  switch (kind) {
    case 'prices':
      return {
        type: 'prices',
        portfolioId: portfolioId ?? PORTFOLIO_ID,
        prices: liveHoldings(ctx).map((h) => ({
          ticker: h.holding.symbol,
          price: h.ltp,
          previousClose: h.prevClose,
          changePct: pctChange(h.ltp, h.prevClose),
        })),
      };
    case 'ticker': {
      const frozen = ctx.market.mode === 'frozen';
      return {
        type: 'ticker',
        session: getNseSession(nowMs).phase,
        quotes: dataset.constituents.map((c, i) => {
          const last = frozen
            ? lastClose(dataset, i)
            : (ctx.market.prices[i] ?? lastClose(dataset, i));
          const prev = frozen ? previousClose(dataset, i) : (ctx.market.referenceCloses[i] ?? last);
          return { symbol: c.symbol, last, changePct: pctChange(last, prev) };
        }),
      };
    }
    case 'alerts':
      return {
        type: 'alerts',
        alerts: ENDPOINTS['alerts/active'].derive(ctx).alerts.filter((a) => !seen.has(a.alertId)),
      };
    case 'news':
      return {
        type: 'news',
        articles: ENDPOINTS['research/feed']
          .derive(ctx)
          .articles.filter((a) => !seen.has(a.articleId)),
      };
  }
};

// ---------------------------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------------------------

export type WsState = 'connected' | 'disconnected';

export interface WsStatus {
  state: WsState;
  /** Why it is disconnected: a simulated server drop or the data feed being offline. */
  reason: 'simulated' | 'network' | null;
  /** Failed reconnect attempts since the connection dropped. */
  failedAttempts: number;
  /** When the next reconnect attempt runs (epoch ms), or null. */
  nextRetryAt: number | null;
  /** Epoch ms of the last state change. */
  since: number;
}

// ---------------------------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------------------------

type Timer = ReturnType<typeof setTimeout>;
type Handler = (message: WsMessage) => void;

interface Channel {
  url: string;
  kind: ChannelKind;
  portfolioId: string | null;
  handlers: Set<Handler>;
  intervalMs: number;
  interval: ReturnType<typeof setInterval> | null;
  deliveries: Set<Timer>;
  seq: number;
  seen: Set<string>;
  /** A build is running; the next tick is skipped rather than queued. */
  building: boolean;
}

export interface WsSimulatorOptions {
  latencyMs?: number;
  /** Clock for timestamps and outage expiry (default Date.now). */
  now?: () => number;
  /** Message source (default: the shared dataset). Tests pass a cheap one. */
  build?: MessageBuilder;
  /** Portfolio ids the prices channel accepts. */
  portfolioIds?: readonly string[];
}

export interface SubscribeOptions {
  /** Message interval for the channel, clamped to its range (CHANNEL_FREQUENCY). */
  intervalMs?: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export class WsSimulator {
  private readonly channels = new Map<string, Channel>();
  private readonly statusListeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly build: MessageBuilder;
  private readonly portfolioIds: ReadonlySet<string>;
  private latencyMs: number;
  private status: WsStatus;
  private reconnectTimer: Timer | null = null;
  /** Server unreachable until this time (ms); null when it is up. */
  private serverDownUntil: number | null = null;
  private detachConnection: (() => void) | null = null;
  private lastDelivery = 0;

  constructor(options: WsSimulatorOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.build = options.build ?? buildFromDataset;
    this.portfolioIds = new Set(options.portfolioIds ?? [PORTFOLIO_ID]);
    this.latencyMs = clamp(options.latencyMs ?? DEFAULT_LATENCY_MS, 0, MAX_LATENCY_MS);
    this.status = {
      state: 'connected',
      reason: null,
      failedAttempts: 0,
      nextRetryAt: null,
      since: this.now(),
    };
  }

  // -- subscriptions --------------------------------------------------------------------------

  /**
   * Receive messages from a channel. Returns a function that unsubscribes this handler; the
   * channel's timers stop when its last handler leaves.
   */
  subscribe<U extends ChannelUrl>(
    url: U,
    handler: (message: MessageFor<U>) => void,
    options: SubscribeOptions = {},
  ): () => void {
    const parsed = parseChannelUrl(url);
    if (!parsed) throw new WsSubscribeError(`Unknown channel ${url}`);
    if (parsed.kind === 'prices' && !this.portfolioIds.has(parsed.portfolioId ?? '')) {
      throw new WsSubscribeError(`No portfolio "${parsed.portfolioId ?? ''}" on ${url}`);
    }
    let channel = this.channels.get(url);
    if (!channel) {
      channel = {
        url,
        kind: parsed.kind,
        portfolioId: parsed.portfolioId,
        handlers: new Set(),
        intervalMs: CHANNEL_FREQUENCY[parsed.kind].default,
        interval: null,
        deliveries: new Set(),
        seq: 0,
        seen: new Set(),
        building: false,
      };
      this.channels.set(url, channel);
    }
    // The channel delivers the union of message types; this handler is only registered on a
    // channel whose kind matches U, so it only ever receives MessageFor<U>.
    const erased = (message: WsMessage) => {
      if (isMessageFor(url, message)) handler(message);
    };
    channel.handlers.add(erased);
    if (options.intervalMs !== undefined) this.setFrequency(url, options.intervalMs);
    this.attachConnection();
    if (this.status.state === 'connected') {
      if (!isConnected()) this.goDisconnected('network');
      else if (this.isServerDown()) this.goDisconnected('simulated');
      else this.startChannel(channel);
    } else if (this.reconnectTimer === null) {
      this.scheduleReconnect();
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.removeHandler(url, erased);
    };
  }

  /** Remove every handler of a channel and stop it. */
  unsubscribe(url: ChannelUrl): void {
    const channel = this.channels.get(url);
    if (!channel) return;
    channel.handlers.clear();
    this.dropChannel(channel);
  }

  private removeHandler(url: string, handler: Handler): void {
    const channel = this.channels.get(url);
    if (!channel) return;
    channel.handlers.delete(handler);
    if (channel.handlers.size === 0) this.dropChannel(channel);
  }

  private dropChannel(channel: Channel): void {
    this.stopChannel(channel);
    this.channels.delete(channel.url);
    if (this.channels.size === 0) {
      // Nobody is listening: stop reconnecting, stop watching the feed and go idle. The next
      // subscription checks again whether the server can be reached.
      this.clearReconnect();
      this.detachConnection?.();
      this.detachConnection = null;
      if (this.status.state === 'disconnected') {
        this.setStatus({
          state: 'connected',
          reason: null,
          failedAttempts: 0,
          nextRetryAt: null,
          since: this.now(),
        });
      }
    }
  }

  /** Change a channel's message interval (clamped to its range). Returns the interval used. */
  setFrequency(url: ChannelUrl, intervalMs: number): number {
    const parsed = parseChannelUrl(url);
    if (!parsed) throw new WsSubscribeError(`Unknown channel ${url}`);
    const range = CHANNEL_FREQUENCY[parsed.kind];
    const applied = clamp(Math.round(intervalMs), range.min, range.max);
    const channel = this.channels.get(url);
    if (channel && channel.intervalMs !== applied) {
      channel.intervalMs = applied;
      if (channel.interval !== null) {
        this.stopTicking(channel);
        this.startChannel(channel);
      }
    }
    return applied;
  }

  frequencyOf(url: ChannelUrl): number | null {
    return this.channels.get(url)?.intervalMs ?? null;
  }

  /** Delay between a message being produced and delivered (0–5000 ms). */
  setLatency(ms: number): number {
    this.latencyMs = clamp(Math.round(ms), 0, MAX_LATENCY_MS);
    return this.latencyMs;
  }

  getLatency(): number {
    return this.latencyMs;
  }

  /** Channel URLs with at least one subscriber. */
  activeChannels(): string[] {
    return [...this.channels.keys()];
  }

  /** Running intervals and timeouts (channels, in-flight messages, reconnect). For leak checks. */
  timerCount(): number {
    let count = this.reconnectTimer === null ? 0 : 1;
    for (const c of this.channels.values())
      count += (c.interval === null ? 0 : 1) + c.deliveries.size;
    return count;
  }

  // -- connection -----------------------------------------------------------------------------

  getStatus = (): WsStatus => this.status;

  /** Epoch ms of the last delivered message, 0 before the first. Not part of the status, so
   * status subscribers do not re-render on every message. */
  lastMessageAt(): number {
    return this.lastDelivery;
  }

  subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  };

  /**
   * Drop the connection as if the server went away for `durationMs` (default 20 s; Infinity
   * until `restore`). Reconnect attempts follow the backoff and succeed once it is back.
   */
  simulateDisconnect(durationMs: number = DEFAULT_OUTAGE_MS): void {
    this.serverDownUntil = Number.isFinite(durationMs)
      ? this.now() + Math.max(0, durationMs)
      : Number.POSITIVE_INFINITY;
    this.goDisconnected('simulated');
  }

  /** End a simulated outage. The next reconnect attempt succeeds (call `retryNow` to not wait). */
  restore(): void {
    this.serverDownUntil = null;
    this.setStatus({ ...this.status });
  }

  /** Whether a simulated server outage is in effect. */
  isServerDown(): boolean {
    return this.serverDownUntil !== null && this.now() < this.serverDownUntil;
  }

  /** Try to reconnect now instead of waiting for the next backoff step. */
  retryNow(): void {
    if (this.status.state === 'connected') return;
    this.clearReconnect();
    this.attempt();
  }

  /** Stop everything: channels, in-flight messages, reconnects and listeners. */
  destroy(): void {
    for (const channel of [...this.channels.values()]) {
      channel.handlers.clear();
      this.dropChannel(channel);
    }
    this.clearReconnect();
    this.statusListeners.clear();
    this.serverDownUntil = null;
  }

  private attachConnection(): void {
    if (this.detachConnection) return;
    this.detachConnection = subscribeConnection((state) => {
      if (!state.connected) this.goDisconnected('network');
      else if (this.status.state === 'disconnected') this.retryNow();
    });
  }

  private reachable(): boolean {
    return isConnected() && !this.isServerDown();
  }

  private goDisconnected(reason: 'simulated' | 'network'): void {
    for (const channel of this.channels.values()) this.stopChannel(channel, false);
    if (this.status.state === 'disconnected') {
      this.setStatus({ ...this.status, reason });
      return;
    }
    this.clearReconnect();
    this.setStatus({
      ...this.status,
      state: 'disconnected',
      reason,
      failedAttempts: 0,
      nextRetryAt: null,
      since: this.now(),
    });
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.channels.size === 0) {
      this.setStatus({ ...this.status, nextRetryAt: null });
      return;
    }
    const delay = backoffDelay(this.status.failedAttempts);
    this.setStatus({ ...this.status, nextRetryAt: this.now() + delay });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.attempt();
    }, delay);
  }

  private attempt(): void {
    if (!this.reachable()) {
      this.setStatus({ ...this.status, failedAttempts: this.status.failedAttempts + 1 });
      this.scheduleReconnect();
      return;
    }
    this.serverDownUntil = null;
    this.setStatus({
      ...this.status,
      state: 'connected',
      reason: null,
      failedAttempts: 0,
      nextRetryAt: null,
      since: this.now(),
    });
    for (const channel of this.channels.values()) this.startChannel(channel);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setStatus(next: WsStatus): void {
    this.status = next;
    for (const listener of [...this.statusListeners]) listener();
  }

  // -- ticking --------------------------------------------------------------------------------

  private startChannel(channel: Channel): void {
    if (channel.interval !== null || this.status.state !== 'connected') return;
    channel.interval = setInterval(() => void this.tick(channel), channel.intervalMs);
  }

  private stopTicking(channel: Channel): void {
    if (channel.interval !== null) clearInterval(channel.interval);
    channel.interval = null;
  }

  /** Stop a channel's interval and drop messages still in flight. */
  private stopChannel(channel: Channel, forget = true): void {
    this.stopTicking(channel);
    for (const t of channel.deliveries) clearTimeout(t);
    channel.deliveries.clear();
    if (forget) channel.seen.clear();
  }

  private async tick(channel: Channel): Promise<void> {
    if (channel.building || this.status.state !== 'connected') return;
    channel.building = true;
    let body: MessageBody;
    try {
      body = await this.build({
        kind: channel.kind,
        portfolioId: channel.portfolioId,
        nowMs: this.now(),
        seen: channel.seen,
      });
    } catch (error) {
      console.error(`[ws] ${channel.url}: could not build a message`, error);
      return;
    } finally {
      channel.building = false;
    }
    // The channel may have been dropped or the connection lost while building.
    if (this.channels.get(channel.url) !== channel || channel.interval === null) return;
    const wire: unknown = JSON.parse(
      JSON.stringify({
        ...body,
        channel: channel.url,
        seq: channel.seq + 1,
        sentAt: toIstIso(this.now()),
        simulated: true,
      }),
    );
    const parsed = SCHEMAS[channel.kind].safeParse(wire);
    if (!parsed.success) {
      console.error(`[ws] ${channel.url}: dropped an invalid message`, parsed.error.issues[0]);
      return;
    }
    channel.seq += 1;
    const message: WsMessage = parsed.data;
    if (message.type === 'alerts') for (const a of message.alerts) channel.seen.add(a.alertId);
    if (message.type === 'news') for (const a of message.articles) channel.seen.add(a.articleId);

    const deliver = () => {
      channel.deliveries.delete(timer);
      if (this.status.state !== 'connected') return;
      this.lastDelivery = this.now();
      for (const handler of [...channel.handlers]) {
        try {
          handler(message);
        } catch (error) {
          console.error(`[ws] ${channel.url}: a subscriber threw`, error);
        }
      }
    };
    const timer = setTimeout(deliver, this.latencyMs);
    channel.deliveries.add(timer);
  }
}

function isMessageFor<U extends ChannelUrl>(url: U, message: WsMessage): message is MessageFor<U> {
  const parsed = parseChannelUrl(url);
  return parsed?.kind === message.type;
}

/** The app's simulator. Idle (no timers) until something subscribes. */
export const wsSimulator = new WsSimulator();
