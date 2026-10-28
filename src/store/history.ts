import { useSyncExternalStore } from 'react';
import type { PageId, PageSnapshot } from '@/types';

/** One undoable layout change: the page as it was before and after. */
export interface HistoryEntry {
  page: PageId;
  /** Short description for toasts and button titles, e.g. "Move widget". */
  label: string;
  before: PageSnapshot;
  after: PageSnapshot;
}

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  /** Label of the change Undo would revert. */
  undoLabel: string | null;
  redoLabel: string | null;
}

/** Same layout, settings and instances (snapshots are plain JSON). */
function sameSnapshot(a: PageSnapshot, b: PageSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Undo/redo history of layout changes, kept in memory only (not persisted and not one of the
 * four stores: it holds snapshots, not app state). Recording a change clears the redo stack;
 * a change that leaves the page as it was is ignored. Oldest entries drop off past `limit`.
 */
export class LayoutHistory {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private listeners = new Set<() => void>();
  private state: HistoryState = {
    canUndo: false,
    canRedo: false,
    undoLabel: null,
    redoLabel: null,
  };

  private readonly limit: number;

  constructor(limit = 50) {
    this.limit = limit;
  }

  record(entry: HistoryEntry): boolean {
    if (sameSnapshot(entry.before, entry.after)) return false;
    this.past.push(entry);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.changed();
    return true;
  }

  /** Take the latest change off the undo stack; the caller restores `entry.before`. */
  undo(): HistoryEntry | null {
    const entry = this.past.pop();
    if (!entry) return null;
    this.future.push(entry);
    this.changed();
    return entry;
  }

  /** Take the latest undone change back; the caller restores `entry.after`. */
  redo(): HistoryEntry | null {
    const entry = this.future.pop();
    if (!entry) return null;
    this.past.push(entry);
    this.changed();
    return entry;
  }

  /** Forget everything (after an explicit save). */
  clear(): void {
    if (this.past.length === 0 && this.future.length === 0) return;
    this.past = [];
    this.future = [];
    this.changed();
  }

  getState(): HistoryState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    this.state = {
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
      undoLabel: this.past[this.past.length - 1]?.label ?? null,
      redoLabel: this.future[this.future.length - 1]?.label ?? null,
    };
    for (const listener of this.listeners) listener();
  }
}

/** The app's layout history. */
export const layoutHistory = new LayoutHistory();

/** Undo/redo availability for toolbar buttons. */
export function useLayoutHistory(): HistoryState {
  return useSyncExternalStore(
    (cb) => layoutHistory.subscribe(cb),
    () => layoutHistory.getState(),
    () => layoutHistory.getState(),
  );
}
