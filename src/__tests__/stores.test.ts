import { compressToEncodedURIComponent } from 'lz-string';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSnapshot } from '@/registry/pages';
import {
  addWidgetToPage,
  applyGridConfig,
  applySnapshot,
  captureSnapshot,
  duplicateWidget,
  removeWidgetFromPage,
  resetPage,
  restoreRemovedWidget,
} from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useLayoutStore } from '@/store/layoutStore';
import { decodeShare, encodeShare, MAX_LAYOUT_BYTES, snapshotBytes } from '@/store/share';
import { createValidatedStorage } from '@/store/storage';
import { useThemeStore } from '@/store/themeStore';
import { useWidgetStore } from '@/store/widgetStore';
import { PageSnapshotSchema } from '@/store/schemas';
import { DEFAULT_GRID_CONFIG } from '@/utils/gridLayout';
import { hasOverlap } from './fixtures';

const initial = {
  dashboard: useDashboardStore.getState(),
  widgets: useWidgetStore.getState(),
  theme: useThemeStore.getState(),
  layouts: useLayoutStore.getState(),
};

beforeEach(() => {
  useDashboardStore.setState(initial.dashboard, true);
  useWidgetStore.setState(initial.widgets, true);
  useThemeStore.setState(initial.theme, true);
  useLayoutStore.setState(initial.layouts, true);
});

describe('cross-store actions', () => {
  it('starts with 10 widgets on the workstation page', () => {
    const grid = useDashboardStore.getState().pages.workstation;
    expect(grid.itemIds).toHaveLength(10);
    for (const id of grid.itemIds) expect(useWidgetStore.getState().instances[id]).toBeDefined();
  });

  it('adds a widget at the bottom with its default size', () => {
    const id = addWidgetToPage('risk', 'trade-blotter');
    expect(id).not.toBeNull();
    const lg = useDashboardStore.getState().pages.risk.layouts.lg ?? [];
    const item = lg.find((l) => l.i === id);
    expect(item).toMatchObject({ x: 0, w: 12, h: 5 });
    expect(useWidgetStore.getState().instances[id ?? '']?.position).toEqual(
      item && { x: item.x, y: item.y, w: item.w, h: item.h },
    );
    const others = lg.filter((l) => l.i !== id);
    expect(item?.y).toBe(Math.max(...others.map((l) => l.y + l.h)));
  });

  it('ignores unknown widget types', () => {
    expect(addWidgetToPage('risk', 'not-a-widget')).toBeNull();
  });

  it('removes and restores a widget at its original position (undo)', () => {
    const id = 'workstation-var-gauge';
    const before = useDashboardStore
      .getState()
      .pages.workstation.layouts.lg?.find((l) => l.i === id);
    const removed = removeWidgetFromPage('workstation', id);
    expect(useWidgetStore.getState().instances[id]).toBeUndefined();
    expect(useDashboardStore.getState().pages.workstation.itemIds).not.toContain(id);
    if (!removed) throw new Error('expected a removal record');
    restoreRemovedWidget(removed);
    const after = useDashboardStore
      .getState()
      .pages.workstation.layouts.lg?.find((l) => l.i === id);
    expect(after).toEqual(before);
    expect(useWidgetStore.getState().instances[id]?.widgetId).toBe('var-gauge');
  });

  it('duplicates a widget with its settings', () => {
    useWidgetStore.getState().updateConfig('workstation-nav-performance', { range: '5Y' });
    const copy = duplicateWidget('workstation', 'workstation-nav-performance');
    if (!copy) throw new Error('expected a copy id');
    const inst = useWidgetStore.getState().instances[copy];
    expect(inst?.config).toEqual({ range: '5Y' });
    expect(inst?.title).toMatch(/\(copy\)$/);
    expect(useDashboardStore.getState().pages.workstation.itemIds).toContain(copy);
  });

  it('applies a snapshot with fresh ids and drops unknown widget types', () => {
    const snap = defaultSnapshot('research');
    applySnapshot('holdings', {
      ...snap,
      instances: [
        ...snap.instances,
        { instanceId: 'x', widgetId: 'ghost', config: {}, position: { x: 0, y: 0, w: 4, h: 4 } },
      ],
    });
    const grid = useDashboardStore.getState().pages.holdings;
    expect(grid.itemIds).toHaveLength(snap.instances.length);
    const originalIds = new Set(snap.instances.map((i) => i.instanceId));
    expect(grid.itemIds.some((id) => originalIds.has(id))).toBe(false);
    expect(grid.layouts.lg).toHaveLength(snap.instances.length);
  });

  it('resets a page to its defaults', () => {
    addWidgetToPage('performance', 'alerts-monitor');
    resetPage('performance');
    expect(captureSnapshot('performance')).toEqual(defaultSnapshot('performance'));
  });

  it('converts snapshots saved on the old 28 px grid when applying them', () => {
    const legacy = {
      page: 'risk' as const,
      layouts: {
        lg: [
          { i: 'risk-risk-metrics', x: 0, y: 0, w: 12, h: 4 },
          { i: 'risk-var-gauge', x: 0, y: 4, w: 4, h: 11 },
        ],
      },
      instances: defaultSnapshot('risk').instances.slice(0, 2),
    };
    applySnapshot('risk', legacy, true);
    expect(useDashboardStore.getState().pages.risk.layouts.lg).toEqual([
      { i: 'risk-risk-metrics', x: 0, y: 0, w: 12, h: 2 },
      { i: 'risk-var-gauge', x: 0, y: 2, w: 4, h: 6 },
    ]);
  });

  it('records the grid in snapshots and converts them to the current grid', () => {
    const snap = captureSnapshot('workstation');
    expect(snap.grid).toEqual(DEFAULT_GRID_CONFIG);
    expect(applyGridConfig({ cols: 24 })).toBe(true);
    applySnapshot('holdings', snap);
    const lg = useDashboardStore.getState().pages.holdings.layouts.lg ?? [];
    expect(Math.max(...lg.map((l) => l.x + l.w))).toBe(24);
    expect(hasOverlap(lg)).toBe(false);
  });

  it('applyGridConfig keeps instance positions in step with the grid', () => {
    expect(applyGridConfig({ cols: 24, rowHeight: 40 })).toBe(true);
    const lg = useDashboardStore.getState().pages.workstation.layouts.lg ?? [];
    for (const item of lg) {
      expect(useWidgetStore.getState().instances[item.i]?.position).toEqual({
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      });
    }
    expect(applyGridConfig({ gap: 99 })).toBe(false);
  });

  it('keeps layout JSON far below the 50 KB budget', () => {
    for (const page of ['workstation', 'risk', 'holdings', 'performance', 'research'] as const) {
      expect(snapshotBytes(captureSnapshot(page))).toBeLessThan(MAX_LAYOUT_BYTES / 10);
    }
  });
});

describe('share links', () => {
  it('round-trips a snapshot', () => {
    const snap = captureSnapshot('workstation');
    const decoded = decodeShare(encodeShare(snap, 'porcelain'));
    expect(decoded.ok && decoded.payload.snapshot).toEqual(snap);
    expect(decoded.ok && decoded.payload.themeId).toBe('porcelain');
  });

  it('rejects corrupted or tampered links', () => {
    expect(decodeShare('not-a-real-link').ok).toBe(false);
    const tampered = compressToEncodedURIComponent(
      JSON.stringify({ v: 1, snapshot: { page: 'nope' } }),
    );
    expect(decodeShare(tampered).ok).toBe(false);
  });

  it('sanitises widget titles from shared links', () => {
    const snap = captureSnapshot('research');
    const first = snap.instances[0];
    if (!first) throw new Error('no instances');
    const evil = { ...snap, instances: [{ ...first, title: '<img src=x onerror=alert(1)>Feed' }] };
    const decoded = decodeShare(encodeShare(evil));
    expect(decoded.ok && decoded.payload.snapshot.instances[0]?.title).toBe('Feed');
  });
});

describe('validated persistence', () => {
  it('discards persisted state that fails validation', () => {
    const storage = createValidatedStorage(PageSnapshotSchema);
    localStorage.setItem(
      'k',
      JSON.stringify({ state: { page: 'risk', layouts: {}, instances: 'oops' }, version: 1 }),
    );
    expect(storage.getItem('k')).toBeNull();
    localStorage.setItem('k', '{not json');
    expect(storage.getItem('k')).toBeNull();
    storage.setItem('k', { state: defaultSnapshot('risk'), version: 1 });
    const stored = storage.getItem('k');
    if (stored instanceof Promise) throw new Error('expected synchronous storage');
    expect(stored?.state).toEqual(defaultSnapshot('risk'));
  });
});
