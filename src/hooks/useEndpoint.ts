import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchEndpoint, type EndpointDataMap } from '@/data';
import type { DataSourceConfig, EndpointId } from '@/types';

export const endpointKey = (endpoint: EndpointId) => ['endpoint', endpoint] as const;

/**
 * Each widget subscribes to its own endpoint with its own refresh interval. Widgets that share
 * an endpoint share the cached response, so totals agree and requests are de-duplicated.
 */
export function useEndpoint<E extends EndpointId>(
  endpoint: E,
  refreshIntervalMs: number,
  enabled = true,
): UseQueryResult<EndpointDataMap[E], Error> {
  return useQuery({
    queryKey: endpointKey(endpoint),
    queryFn: ({ signal }) => fetchEndpoint(endpoint, { signal }),
    refetchInterval: refreshIntervalMs,
    refetchIntervalInBackground: false,
    staleTime: refreshIntervalMs / 2,
    // Keep the validated object identity; validation tags objects by identity.
    structuralSharing: false,
    enabled,
  });
}

export function useDataSource(source: DataSourceConfig, enabled = true) {
  return useEndpoint(source.endpoint, source.refreshIntervalMs, enabled);
}
