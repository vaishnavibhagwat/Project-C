import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { getDataControls, subscribeDataControls } from '@/data/controls';
import { startRealtimeBridge } from '@/data/realtime';
import { wsSimulator, type WsStatus } from '@/data/wsSimulator';
import { endpointKey } from './useEndpoint';

/** Connection state of the simulated WebSocket (connected, or disconnected and retrying). */
export function useRealtimeStatus(): WsStatus {
  return useSyncExternalStore(
    wsSimulator.subscribeStatus,
    wsSimulator.getStatus,
    wsSimulator.getStatus,
  );
}

/**
 * Mount once, inside the QueryClientProvider: subscribes to the simulated channels and
 * refreshes the affected queries on every message. Unmounting unsubscribes everything.
 * Resuming paused live updates refreshes every query at once.
 */
export function useRealtimeBridge(): void {
  const client = useQueryClient();
  useEffect(() => {
    let paused = getDataControls().paused;
    return subscribeDataControls(() => {
      const next = getDataControls().paused;
      if (paused && !next) void client.invalidateQueries({ refetchType: 'active' });
      paused = next;
    });
  }, [client]);
  useEffect(
    () =>
      startRealtimeBridge((endpoints) => {
        for (const endpoint of endpoints) {
          void client.invalidateQueries({ queryKey: endpointKey(endpoint), refetchType: 'active' });
        }
      }),
    [client],
  );
}
