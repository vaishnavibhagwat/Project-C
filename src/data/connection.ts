/**
 * Simulated data-feed connection. Combines the browser's online flag with a user-controlled
 * "simulate outage" switch so the disconnected state can be demonstrated on demand.
 */

export interface ConnectionState {
  browserOnline: boolean;
  simulatedOutage: boolean;
  connected: boolean;
  /** Epoch ms of the last change, for "disconnected since" labels. */
  changedAt: number;
}

type Listener = (state: ConnectionState) => void;

const listeners = new Set<Listener>();

let current: ConnectionState = {
  browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  simulatedOutage: false,
  connected: typeof navigator === 'undefined' ? true : navigator.onLine,
  changedAt: Date.now(),
};

function update(patch: Partial<Pick<ConnectionState, 'browserOnline' | 'simulatedOutage'>>) {
  const next = { ...current, ...patch };
  const connected = next.browserOnline && !next.simulatedOutage;
  if (
    next.browserOnline === current.browserOnline &&
    next.simulatedOutage === current.simulatedOutage
  ) {
    return;
  }
  current = { ...next, connected, changedAt: Date.now() };
  for (const listener of listeners) listener(current);
}

const onOnline = () => update({ browserOnline: true });
const onOffline = () => update({ browserOnline: false });

/** Subscribe to connection changes. Returns an unsubscribe function that removes listeners. */
export function subscribeConnection(listener: Listener): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    }
  };
}

export function getConnectionState(): ConnectionState {
  return current;
}

export function isConnected(): boolean {
  return current.connected;
}

export function setSimulatedOutage(outage: boolean): void {
  update({ simulatedOutage: outage });
}
