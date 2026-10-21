import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError, parseEndpoint, setSimulatedOutage } from '@/data';
import { fixture } from '@/__tests__/fixtures';
import { endpointKey, EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import type { EndpointId } from '@/types';

/** A widget-sized panel so widget bodies render at a realistic size in isolation. */
export function WidgetCanvas({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded border border-line bg-panel" style={{ width, height }}>
      {children}
    </div>
  );
}

/** Never resolves: keeps a widget in its loading state. */
export const pendingFetcher: EndpointFetcher = () => new Promise(() => undefined);

/** Always fails like an upstream outage. */
export const failingFetcher: EndpointFetcher = () =>
  Promise.reject(new ApiError('GET /api/… returned 503 (simulated upstream failure)'));

/** Serves validated fixtures immediately (no latency). */
export const fixtureFetcher: EndpointFetcher = (endpoint) => Promise.resolve(fixture(endpoint));

/** Serves validated but empty holdings. */
export const emptyHoldingsFetcher: EndpointFetcher = (endpoint) => {
  if (endpoint !== 'portfolio/holdings') return Promise.resolve(fixture(endpoint));
  const base = fixture('portfolio/holdings');
  return Promise.resolve(parseEndpoint(endpoint, { ...base, holdings: [] }));
};

export function WithFetcher({
  fetcher,
  children,
}: {
  fetcher: EndpointFetcher;
  children: ReactNode;
}) {
  return (
    <EndpointFetcherContext.Provider value={fetcher}>{children}</EndpointFetcherContext.Provider>
  );
}

/** Seeds the query cache with data last updated `ageMs` ago (for stale-state stories). */
export function SeedQuery({
  endpoint,
  ageMs,
  children,
}: {
  endpoint: EndpointId;
  ageMs: number;
  children: ReactNode;
}) {
  const client = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    client.setQueryData(endpointKey(endpoint), fixture(endpoint), {
      updatedAt: Date.now() - ageMs,
    });
    setReady(true);
  }, [ageMs, client, endpoint]);
  return ready ? children : null;
}

/** Turns the simulated feed outage on while mounted. */
export function SimulatedOutage({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setSimulatedOutage(true);
    setReady(true);
    return () => setSimulatedOutage(false);
  }, []);
  return ready ? children : null;
}
