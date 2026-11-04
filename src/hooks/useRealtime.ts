import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
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
 */
export function useRealtimeBridge(): void {
  const client = useQueryClient();
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
