import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

/** Most recent successful data update across every widget query (epoch ms, 0 if none). */
export function useLastUpdated(): number {
  const client = useQueryClient();
  const subscribe = useCallback((cb: () => void) => client.getQueryCache().subscribe(cb), [client]);
  const get = useCallback(
    () =>
      client
        .getQueryCache()
        .getAll()
        .reduce((max, q) => Math.max(max, q.state.dataUpdatedAt), 0),
    [client],
  );
  return useSyncExternalStore(subscribe, get, get);
}
