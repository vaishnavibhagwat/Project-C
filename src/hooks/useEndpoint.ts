import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { fetchEndpoint, type EndpointDataMap, type FetchOptions } from '@/data';
import { isEndpointLive, pollInterval, subscribeLiveEndpoints } from '@/data/realtime';
import type { DataSourceConfig, EndpointId, LatencyProfile } from '@/types';

export const endpointKey = (endpoint: EndpointId) => ['endpoint', endpoint] as const;

export type EndpointFetcher = <E extends EndpointId>(
  endpoint: E,
  options: FetchOptions,
) => Promise<EndpointDataMap[E]>;

/**
 * Where widget data comes from. Defaults to the mock API; stories and tests can provide a
 * fetcher that never resolves, fails or returns empty data to show each widget state.
 */
export const EndpointFetcherContext = createContext<EndpointFetcher>(fetchEndpoint);

/** Whether socket pushes currently keep `endpoint` fresh (see src/data/realtime.ts). */
export function useLiveEndpoint(endpoint: EndpointId): boolean {
  const get = useCallback(() => isEndpointLive(endpoint), [endpoint]);
  return useSyncExternalStore(subscribeLiveEndpoints, get, get);
}

/**
 * Each widget subscribes to its own endpoint with its own refresh interval. Widgets that share
 * an endpoint share the cached response, so totals agree and requests are de-duplicated.
 * While the simulated socket pushes updates for the endpoint, polling drops to a slow
 * heartbeat; when the socket is down it polls at `refreshInterval` (the fallback).
 */
export function useEndpoint<E extends EndpointId>(
  endpoint: E,
  refreshInterval: number,
  enabled = true,
  latencyProfile: LatencyProfile = 'normal',
): UseQueryResult<EndpointDataMap[E], Error> {
  const fetcher = useContext(EndpointFetcherContext);
  const live = useLiveEndpoint(endpoint);
  return useQuery({
    queryKey: endpointKey(endpoint),
    queryFn: ({ signal }) => fetcher(endpoint, { signal, latencyProfile }),
    refetchInterval: pollInterval(refreshInterval, live),
    refetchIntervalInBackground: false,
    staleTime: refreshInterval / 2,
    // Keep the validated object identity; validation tags objects by identity.
    structuralSharing: false,
    enabled,
  });
}

export function useDataSource(source: DataSourceConfig, enabled = true) {
  return useEndpoint(source.endpoint, source.refreshInterval, enabled, source.latencyProfile);
}
