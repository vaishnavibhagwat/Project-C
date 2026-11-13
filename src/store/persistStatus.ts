/**
 * Write status of each persisted store, so the app can say "saved", "saving" or "storage
 * full". Module state like `data/connection.ts`, not a store: it describes localStorage, it is
 * not app data.
 */

export type PersistState = 'saved' | 'pending' | 'error';

export interface PersistStatus {
  state: PersistState;
  /** Epoch ms of the last successful write, if any. */
  savedAt: number | null;
  /** True when the last failure was the browser's storage quota. */
  quotaExceeded: boolean;
}

export type PersistEvent =
  { type: 'error'; name: string; quotaExceeded: boolean } | { type: 'recovered'; name: string };

const IDLE: PersistStatus = { state: 'saved', savedAt: null, quotaExceeded: false };
const statuses = new Map<string, PersistStatus>();
const statusListeners = new Set<() => void>();
const eventListeners = new Set<(event: PersistEvent) => void>();

export function getPersistStatus(name: string): PersistStatus {
  return statuses.get(name) ?? IDLE;
}

export function subscribePersistStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/** Failures and recoveries, once per change of state (not on every retry). */
export function subscribePersistEvents(listener: (event: PersistEvent) => void): () => void {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

function set(name: string, status: PersistStatus): void {
  statuses.set(name, status);
  for (const listener of [...statusListeners]) listener();
}

function emit(event: PersistEvent): void {
  for (const listener of [...eventListeners]) listener(event);
}

export function markPending(name: string): void {
  const current = getPersistStatus(name);
  if (current.state === 'error') return; // stays "error" until a write succeeds
  set(name, { ...current, state: 'pending' });
}

export function markSaved(name: string, at = Date.now()): void {
  const wasError = getPersistStatus(name).state === 'error';
  set(name, { state: 'saved', savedAt: at, quotaExceeded: false });
  if (wasError) emit({ type: 'recovered', name });
}

export function markFailed(name: string, error: unknown): void {
  const current = getPersistStatus(name);
  const quotaExceeded = isQuotaError(error);
  set(name, { ...current, state: 'error', quotaExceeded });
  if (current.state !== 'error') emit({ type: 'error', name, quotaExceeded });
}

/** The browser's "storage full" error, under its names in Chromium, Firefox and Safari. */
export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}

/** Tests: forget every status. */
export function resetPersistStatus(): void {
  statuses.clear();
  for (const listener of [...statusListeners]) listener();
}
