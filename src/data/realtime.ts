import type { EndpointId } from '@/types';
import { isLiveUpdatesPaused } from './controls';
import { PORTFOLIO_ID } from './constants';
import {
  ALERTS_STREAM_URL,
  MARKET_TICKER_URL,
  NEWS_STREAM_URL,
  portfolioPricesUrl,
  wsSimulator,
  type ChannelUrl,
  type WsSimulator,
} from './wsSimulator';

/**
 * Connects the simulated WebSocket channels to the dashboard's data. A message on a channel
 * refreshes the endpoints it affects (the bridge's `onPush`; the app invalidates those
 * queries). While the socket is connected those endpoints are "live" and poll only as a slow
 * heartbeat; when it drops they fall back to their normal polling interval.
 *
 * Simplification: messages carry prices and new items, but the cache is refreshed by
 * re-reading the endpoint (validated as usual) rather than patching it from the message.
 */

export interface RealtimeRoute {
  url: ChannelUrl;
  endpoints: readonly EndpointId[];
}

export const REALTIME_ROUTES: readonly RealtimeRoute[] = [
  {
    url: portfolioPricesUrl(PORTFOLIO_ID),
    endpoints: ['portfolio/holdings', 'portfolio/summary', 'portfolio/allocation', 'risk/exposure'],
  },
  { url: MARKET_TICKER_URL, endpoints: ['market/sector-returns', 'market/ticker'] },
  { url: ALERTS_STREAM_URL, endpoints: ['alerts/active', 'alerts/panel'] },
  { url: NEWS_STREAM_URL, endpoints: ['market/news', 'research/feed'] },
];

/** Polling of live endpoints while the socket is up: a safety net, not the update path. */
export const LIVE_HEARTBEAT_MS = 60_000;

/** Polling interval for an endpoint: its own while not live, a slow heartbeat while live. */
export function pollInterval(refreshInterval: number, live: boolean): number {
  return live ? Math.max(refreshInterval * 4, LIVE_HEARTBEAT_MS) : refreshInterval;
}

const NO_ENDPOINTS: ReadonlySet<EndpointId> = new Set();
let live: ReadonlySet<EndpointId> = NO_ENDPOINTS;
const liveListeners = new Set<() => void>();

function setLive(next: ReadonlySet<EndpointId>): void {
  if (next.size === live.size && [...next].every((e) => live.has(e))) return;
  live = next;
  for (const listener of [...liveListeners]) listener();
}

/** Whether pushes currently keep this endpoint up to date. */
export function isEndpointLive(endpoint: EndpointId): boolean {
  return live.has(endpoint);
}

export function subscribeLiveEndpoints(listener: () => void): () => void {
  liveListeners.add(listener);
  return () => {
    liveListeners.delete(listener);
  };
}

/**
 * Subscribe to every route. `onPush` receives the endpoints a message affects. Returns a
 * cleanup that unsubscribes everything (the simulator's timers stop with the last handler).
 */
export function startRealtimeBridge(
  onPush: (endpoints: readonly EndpointId[]) => void,
  simulator: WsSimulator = wsSimulator,
): () => void {
  const unsubscribers = REALTIME_ROUTES.map((route) =>
    simulator.subscribe(route.url, () => {
      // Paused live updates: pushes are ignored until resumed.
      if (!isLiveUpdatesPaused()) onPush(route.endpoints);
    }),
  );
  const all = new Set(REALTIME_ROUTES.flatMap((r) => r.endpoints));
  const sync = () => setLive(simulator.getStatus().state === 'connected' ? all : NO_ENDPOINTS);
  const stopStatus = simulator.subscribeStatus(sync);
  sync();
  return () => {
    stopStatus();
    for (const unsubscribe of unsubscribers) unsubscribe();
    setLive(NO_ENDPOINTS);
  };
}
