import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { defaultSnapshot } from '@/registry/pages';
import { useLayoutStore } from '@/store/layoutStore';
import {
  getPersistStatus,
  isQuotaError,
  subscribePersistEvents,
  type PersistEvent,
} from '@/store/persistStatus';
import {
  AUTOSAVE_INTERVAL_MS,
  createDebouncedStorage,
  discardPendingWrites,
  flushPendingWrites,
  SAVE_DEBOUNCE_MS,
} from '@/store/storage';

const Schema = z.object({ n: z.number() });
const KEY = 'test:debounced';
const Envelope = z.object({ state: z.unknown() });
const stored = (): unknown => {
  const raw = localStorage.getItem(KEY);
  return raw === null ? null : Envelope.parse(JSON.parse(raw)).state;
};
const initialLayouts = useLayoutStore.getState();
const quotaError = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError');

beforeEach(() => {
  vi.useFakeTimers();
  useLayoutStore.setState(initialLayouts, true);
  discardPendingWrites();
});
afterEach(() => {
  discardPendingWrites();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('debounced persistence', () => {
  it('writes once, 2 s after the last change', () => {
    const storage = createDebouncedStorage(Schema);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    storage.setItem(KEY, { state: { n: 1 }, version: 1 });
    vi.advanceTimersByTime(1500);
    storage.setItem(KEY, { state: { n: 2 }, version: 1 });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
    expect(stored()).toBeNull();
    expect(getPersistStatus(KEY).state).toBe('pending');
    vi.advanceTimersByTime(1);
    expect(stored()).toEqual({ n: 2 });
    expect(write).toHaveBeenCalledTimes(1);
    expect(getPersistStatus(KEY)).toMatchObject({ state: 'saved', quotaExceeded: false });
  });

  it('auto-saves at least every 30 s while changes keep coming', () => {
    const storage = createDebouncedStorage(Schema);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    // A change every second: the 2 s debounce never settles on its own.
    for (let s = 1; s <= 45; s += 1) {
      storage.setItem(KEY, { state: { n: s }, version: 1 });
      vi.advanceTimersByTime(1000);
    }
    expect(write).toHaveBeenCalledTimes(1);
    expect(stored()).toEqual({ n: AUTOSAVE_INTERVAL_MS / 1000 });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(stored()).toEqual({ n: 45 });
  });

  it('writes pending changes at once when the tab is hidden or closed', () => {
    const storage = createDebouncedStorage(Schema);
    storage.setItem(KEY, { state: { n: 7 }, version: 1 });
    window.dispatchEvent(new Event('pagehide'));
    expect(stored()).toEqual({ n: 7 });

    storage.setItem(KEY, { state: { n: 8 }, version: 1 });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(stored()).toEqual({ n: 8 });
  });

  it('reads what is in localStorage and validates it', () => {
    const storage = createDebouncedStorage(Schema);
    localStorage.setItem(KEY, JSON.stringify({ state: { n: 3 }, version: 1 }));
    expect(storage.getItem(KEY)).toEqual({ state: { n: 3 }, version: 1 });
    localStorage.setItem(KEY, JSON.stringify({ state: { n: 'three' }, version: 1 }));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it('removeItem drops a pending write', () => {
    const storage = createDebouncedStorage(Schema);
    storage.setItem(KEY, { state: { n: 1 }, version: 1 });
    storage.removeItem(KEY);
    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS);
    expect(stored()).toBeNull();
  });
});

describe('storage full', () => {
  it('keeps the change in memory, reports it once and retries every 30 s', () => {
    const events: PersistEvent[] = [];
    const stop = subscribePersistEvents((e) => events.push(e));
    const storage = createDebouncedStorage(Schema);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError();
    });

    storage.setItem(KEY, { state: { n: 1 }, version: 1 });
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(getPersistStatus(KEY)).toMatchObject({ state: 'error', quotaExceeded: true });
    expect(events).toEqual([{ type: 'error', name: KEY, quotaExceeded: true }]);

    // More changes and a retry: still failing, but not reported again.
    storage.setItem(KEY, { state: { n: 2 }, version: 1 });
    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS);
    expect(write.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(events).toHaveLength(1);
    expect(getPersistStatus(KEY).state).toBe('error');

    // Space is freed: the next retry writes the latest state and says so.
    write.mockRestore();
    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS);
    expect(stored()).toEqual({ n: 2 });
    expect(events.at(-1)).toEqual({ type: 'recovered', name: KEY });
    expect(getPersistStatus(KEY).state).toBe('saved');
    stop();
  });

  it('a full storage does not break the store: LayoutStore keeps working in memory', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError();
    });
    const id = useLayoutStore
      .getState()
      .saveLayout('Desk', defaultSnapshot('risk'), '2026-11-13T10:00:00+05:30');
    flushPendingWrites();
    expect(useLayoutStore.getState().savedLayouts.map((l) => l.id)).toEqual([id]);
    expect(getPersistStatus('meridian:layouts')).toMatchObject({
      state: 'error',
      quotaExceeded: true,
    });
  });

  it('recognises the quota error in each browser', () => {
    expect(isQuotaError(quotaError())).toBe(true);
    expect(isQuotaError(new DOMException('full', 'NS_ERROR_DOM_QUOTA_REACHED'))).toBe(true);
    expect(isQuotaError(new DOMException('denied', 'SecurityError'))).toBe(false);
    expect(isQuotaError(new Error('QuotaExceededError'))).toBe(false);
  });
});

describe('LayoutStore persistence', () => {
  it('saves layouts to localStorage 2 s after a change', () => {
    useLayoutStore
      .getState()
      .saveLayout('Desk', defaultSnapshot('risk'), '2026-11-13T10:00:00+05:30');
    expect(localStorage.getItem('meridian:layouts')).toBeNull();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    const raw = localStorage.getItem('meridian:layouts');
    expect(raw).not.toBeNull();
    const saved = z
      .object({ state: z.object({ savedLayouts: z.array(z.object({ name: z.string() })) }) })
      .parse(JSON.parse(raw ?? '{}'));
    expect(saved.state.savedLayouts.map((l) => l.name)).toEqual(['Desk']);
  });
});
