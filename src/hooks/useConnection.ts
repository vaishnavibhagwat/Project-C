import { useSyncExternalStore } from 'react';
import { getConnectionState, subscribeConnection, type ConnectionState } from '@/data/connection';

/** Live data-feed connection state (browser online flag + simulated outage switch). */
export function useConnection(): ConnectionState {
  return useSyncExternalStore(subscribeConnection, getConnectionState, getConnectionState);
}
