import { z, type ZodType, type ZodTypeDef } from 'zod';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { env } from '@/utils/env';
import { markFailed, markPending, markSaved } from './persistStatus';

const EnvelopeSchema = z.object({ state: z.unknown(), version: z.number().int().optional() });

/**
 * localStorage adapter for zustand/persist that validates everything it reads with zod.
 * Corrupt or tampered data is discarded (the store falls back to defaults) instead of crashing.
 */
export function createValidatedStorage<S>(
  schema: ZodType<S, ZodTypeDef, unknown>,
): PersistStorage<S> {
  return {
    getItem: (name): StorageValue<S> | null => {
      try {
        const raw = localStorage.getItem(name);
        if (raw === null) return null;
        const envelope = EnvelopeSchema.safeParse(JSON.parse(raw));
        if (!envelope.success) return null;
        const state = schema.safeParse(envelope.data.state);
        if (!state.success) {
          console.warn(`[persist] Discarding invalid "${name}" state`, state.error.issues[0]);
          return null;
        }
        return { state: state.data, version: envelope.data.version };
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      writeItem(name, value);
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch {
        // ignore
      }
    },
  };
}

/**
 * Write one store to localStorage. On failure (quota exceeded, storage disabled) the store keeps
 * working in memory and the failure is reported (persistStatus), so the app can tell the user.
 * Returns whether the write succeeded.
 */
function writeItem<S>(name: string, value: StorageValue<S>): boolean {
  try {
    localStorage.setItem(name, JSON.stringify(value));
    markSaved(name);
    return true;
  } catch (error) {
    markFailed(name, error);
    return false;
  }
}

/** A change is written this long after the last change (bursts become one write). */
export const SAVE_DEBOUNCE_MS = 2000;
/**
 * Auto-save interval: while there are unsaved changes, they are written at least this often,
 * even if changes keep coming. A failed write (storage full) is retried at the same interval.
 */
export const AUTOSAVE_INTERVAL_MS = 30_000;

interface DebouncedWriter {
  flush: () => void;
  discard: () => void;
}
const writers = new Set<DebouncedWriter>();

/** Write every pending change now (tab hidden or closing; tests). */
export function flushPendingWrites(): void {
  for (const writer of writers) writer.flush();
}

/** Tests: drop pending changes and their timers without writing them. */
export function discardPendingWrites(): void {
  for (const writer of writers) writer.discard();
}

const onPageHide = () => flushPendingWrites();
const onVisibility = () => {
  if (document.visibilityState === 'hidden') flushPendingWrites();
};
let pageListeners = 0;
/** Flush when the tab is hidden or closed, while any writer has pending changes. */
function watchPage(on: boolean): void {
  if (typeof window === 'undefined') return;
  pageListeners += on ? 1 : -1;
  if (on && pageListeners === 1) {
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
  } else if (!on && pageListeners === 0) {
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibility);
  }
}

/**
 * Validated localStorage adapter that saves in the background: a change is written
 * SAVE_DEBOUNCE_MS after the last change, and pending changes are written at least every
 * AUTOSAVE_INTERVAL_MS. If a write fails (storage full) the state stays in memory, the failure
 * is reported once and the write is retried every AUTOSAVE_INTERVAL_MS. Pending changes are
 * also written when the tab is hidden or closed. Reads always come from localStorage (the store
 * only reads when it hydrates, before it has written anything).
 */
export function createDebouncedStorage<S>(
  schema: ZodType<S, ZodTypeDef, unknown>,
  { debounceMs = SAVE_DEBOUNCE_MS, autosaveMs = AUTOSAVE_INTERVAL_MS } = {},
): PersistStorage<S> {
  const base = createValidatedStorage(schema);
  const pending = new Map<string, StorageValue<S>>();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    clearTimeout(debounceTimer);
    clearTimeout(autosaveTimer);
    debounceTimer = undefined;
    autosaveTimer = undefined;
  };
  const settle = () => {
    if (pending.size === 0) watchPage(false);
  };
  const flush = () => {
    if (pending.size === 0) return;
    clearTimers();
    for (const [name, value] of [...pending]) {
      if (writeItem(name, value)) pending.delete(name);
    }
    if (pending.size > 0) autosaveTimer = setTimeout(flush, autosaveMs); // retry later
    settle();
  };
  const writer: DebouncedWriter = {
    flush,
    discard: () => {
      const had = pending.size > 0;
      pending.clear();
      clearTimers();
      if (had) watchPage(false);
    },
  };
  writers.add(writer);

  return {
    getItem: (name) => base.getItem(name),
    setItem: (name, value) => {
      if (pending.size === 0) watchPage(true);
      pending.set(name, value);
      markPending(name);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, debounceMs);
      autosaveTimer ??= setTimeout(flush, autosaveMs);
    },
    removeItem: (name) => {
      if (pending.delete(name)) settle();
      if (pending.size === 0) clearTimers();
      base.removeItem(name);
    },
  };
}

export const devtoolsEnabled = import.meta.env.DEV && env.VITE_ENABLE_DEVTOOLS;

/**
 * Id for widget instances, saved layouts and custom themes: a readable prefix plus a v4 UUID
 * (uuid works in every browser context, unlike crypto.randomUUID on non-HTTPS origins).
 */
export function createId(prefix: string): string {
  return `${prefix}-${uuidv4()}`;
}
