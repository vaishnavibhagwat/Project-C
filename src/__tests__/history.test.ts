import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addWidgetToPage,
  captureSnapshot,
  commitLayouts,
  configureWidget,
  duplicateWidget,
  redoLayoutChange,
  removeWidgetFromPage,
  resetPage,
  undoLayoutChange,
} from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { LayoutHistory, layoutHistory, type HistoryEntry } from '@/store/history';
import { useWidgetStore } from '@/store/widgetStore';
import type { PageSnapshot } from '@/types';
import { DEFAULT_GRID_CONFIG, responsiveGridProps } from '@/utils/gridLayout';

/** A snapshot whose only difference is one widget's x, so entries are distinguishable. */
function snap(x: number): PageSnapshot {
  return {
    page: 'workstation',
    layouts: { desktop: [{ i: 'a', x, y: 0, w: 4, h: 3 }] },
    instances: [],
    grid: DEFAULT_GRID_CONFIG,
  };
}

function entry(label: string, from: number, to: number): HistoryEntry {
  return { page: 'workstation', label, before: snap(from), after: snap(to) };
}

describe('LayoutHistory', () => {
  it('starts empty', () => {
    const h = new LayoutHistory();
    expect(h.getState()).toEqual({
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null,
    });
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBeNull();
  });

  it('undoes newest first and redoes in the original order', () => {
    const h = new LayoutHistory();
    h.record(entry('Move widget', 0, 2));
    h.record(entry('Resize widget', 2, 4));
    expect(h.getState().undoLabel).toBe('Resize widget');
    expect(h.undo()?.label).toBe('Resize widget');
    expect(h.undo()?.label).toBe('Move widget');
    expect(h.undo()).toBeNull();
    expect(h.getState()).toMatchObject({ canUndo: false, canRedo: true, redoLabel: 'Move widget' });
    expect(h.redo()?.label).toBe('Move widget');
    expect(h.redo()?.label).toBe('Resize widget');
    expect(h.redo()).toBeNull();
    expect(h.getState()).toMatchObject({ canUndo: true, canRedo: false });
  });

  it('clears the redo stack when a new change is recorded', () => {
    const h = new LayoutHistory();
    h.record(entry('Move widget', 0, 2));
    h.undo();
    expect(h.getState().canRedo).toBe(true);
    h.record(entry('Add widget', 0, 6));
    expect(h.getState()).toMatchObject({ canRedo: false, undoLabel: 'Add widget' });
  });

  it('ignores a change that leaves the page as it was', () => {
    const h = new LayoutHistory();
    expect(h.record(entry('Move widget', 3, 3))).toBe(false);
    expect(h.getState().canUndo).toBe(false);
  });

  it('keeps only the newest entries past its limit', () => {
    const h = new LayoutHistory(3);
    for (let i = 0; i < 5; i += 1) h.record(entry(`Change ${i}`, i, i + 1));
    expect([h.undo(), h.undo(), h.undo(), h.undo()].map((e) => e?.label ?? null)).toEqual([
      'Change 4',
      'Change 3',
      'Change 2',
      null,
    ]);
  });

  it('clear() forgets undo and redo and notifies subscribers', () => {
    const h = new LayoutHistory();
    const listener = vi.fn();
    const unsubscribe = h.subscribe(listener);
    h.record(entry('Move widget', 0, 1));
    h.record(entry('Move widget', 1, 2));
    h.undo();
    expect(listener).toHaveBeenCalledTimes(3);
    h.clear();
    expect(listener).toHaveBeenCalledTimes(4);
    expect(h.getState()).toMatchObject({ canUndo: false, canRedo: false });
    // Clearing an empty history is not a change.
    h.clear();
    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
    h.record(entry('Move widget', 0, 1));
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('returns a stable state object between changes (for useSyncExternalStore)', () => {
    const h = new LayoutHistory();
    h.record(entry('Move widget', 0, 1));
    expect(h.getState()).toBe(h.getState());
  });
});

describe('undo / redo of layout actions', () => {
  const initial = {
    dashboard: useDashboardStore.getState(),
    widgets: useWidgetStore.getState(),
  };
  beforeEach(() => {
    useDashboardStore.setState(initial.dashboard, true);
    useWidgetStore.setState(initial.widgets, true);
  });

  const page = 'risk' as const;
  const state = () => JSON.stringify(captureSnapshot(page));
  const firstId = () => useDashboardStore.getState().pages[page].itemIds[0] ?? '';

  it('undoes and redoes adding a widget', () => {
    const before = state();
    const id = addWidgetToPage(page, 'research-feed');
    expect(id).not.toBeNull();
    const after = state();
    expect(undoLayoutChange()?.label).toBe('Add widget');
    expect(state()).toBe(before);
    expect(useWidgetStore.getState().instances[id ?? '']).toBeUndefined();
    expect(redoLayoutChange()?.label).toBe('Add widget');
    expect(state()).toBe(after);
  });

  it('undoes removing and duplicating a widget', () => {
    const before = state();
    const count = useDashboardStore.getState().pages[page].itemIds.length;
    const id = firstId();
    removeWidgetFromPage(page, id);
    expect(undoLayoutChange()?.label).toBe('Remove widget');
    expect(state()).toBe(before);
    duplicateWidget(page, id);
    expect(useDashboardStore.getState().pages[page].itemIds).toHaveLength(count + 1);
    expect(undoLayoutChange()?.label).toBe('Duplicate widget');
    expect(state()).toBe(before);
  });

  it('records grid commits that carry a label (drag, resize) and not the others', () => {
    const before = state();
    const layouts = useDashboardStore.getState().pages[page].layouts;
    const desktop = (layouts.desktop ?? []).map((l, i) => (i === 0 ? { ...l, y: l.y + 20 } : l));
    commitLayouts(page, { ...layouts, desktop }, 'Move widget');
    expect(layoutHistory.getState().undoLabel).toBe('Move widget');
    // Unlabelled commits (derived breakpoints, react-grid-layout's safety net) are not undoable.
    commitLayouts(page, layouts);
    expect(layoutHistory.getState().undoLabel).toBe('Move widget');
    layoutHistory.clear();
    commitLayouts(page, { ...layouts, desktop }, 'Resize widget');
    expect(undoLayoutChange()?.label).toBe('Resize widget');
    expect(state()).toBe(before);
  });

  it('undoes a settings change', () => {
    const id = firstId();
    const title = useWidgetStore.getState().instances[id]?.title;
    configureWidget(id, { note: 'x' }, 'Renamed');
    expect(useWidgetStore.getState().instances[id]?.title).toBe('Renamed');
    expect(undoLayoutChange()?.label).toBe('Configure widget');
    expect(useWidgetStore.getState().instances[id]?.title).toBe(title);
  });

  it('records a reset once, as the outermost change', () => {
    addWidgetToPage(page, 'research-feed');
    resetPage(page);
    expect(layoutHistory.getState().undoLabel).toBe('Reset layout');
    undoLayoutChange();
    expect(layoutHistory.getState().undoLabel).toBe('Add widget');
  });

  it('does not record undo and redo themselves', () => {
    addWidgetToPage(page, 'research-feed');
    undoLayoutChange();
    expect(layoutHistory.getState()).toMatchObject({ canUndo: false, canRedo: true });
    redoLayoutChange();
    expect(layoutHistory.getState()).toMatchObject({ canUndo: true, canRedo: false });
  });
});

describe('density', () => {
  it('scales the grid row height and gap without touching stored layouts', () => {
    const before = JSON.stringify(useDashboardStore.getState().pages);
    useDashboardStore.getState().setDensity('compact');
    expect(useDashboardStore.getState().density).toBe('compact');
    expect(JSON.stringify(useDashboardStore.getState().pages)).toBe(before);
    const comfortable = responsiveGridProps(DEFAULT_GRID_CONFIG);
    const compact = responsiveGridProps(DEFAULT_GRID_CONFIG, undefined, 'compact');
    expect(comfortable.rowHeight).toBe(DEFAULT_GRID_CONFIG.rowHeight);
    expect(compact.rowHeight).toBeLessThan(comfortable.rowHeight);
    expect(compact.margin[0]).toBeLessThan(comfortable.margin[0]);
    useDashboardStore.getState().setDensity('comfortable');
  });
});
