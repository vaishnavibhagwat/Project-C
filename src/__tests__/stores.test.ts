import { compressToEncodedURIComponent } from 'lz-string';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSnapshot } from '@/registry/pages';
import {
  addWidget,
  applySnapshot,
  captureSnapshot,
  duplicateWidget,
  removeWidget,
  resetPage,
  restoreWidget,
} from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useLayoutStore } from '@/store/layoutStore';
import { decodeShare, encodeShare, MAX_LAYOUT_BYTES, snapshotBytes } from '@/store/share';
import { createValidatedStorage } from '@/store/storage';
import { selectPaintedTheme, useThemeStore } from '@/store/themeStore';
import { useWidgetStore } from '@/store/widgetStore';
import { PageSnapshotSchema } from '@/store/schemas';
import { DEFAULT_THEME_ID, MIDNIGHT_GRAPHITE } from '@/theme/themes';

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

describe('DashboardStore + WidgetStore', () => {
  it('starts with 10 widgets on the workstation page', () => {
    const grid = useDashboardStore.getState().pages.workstation;
    expect(grid.itemIds).toHaveLength(10);
    for (const id of grid.itemIds) expect(useWidgetStore.getState().instances[id]).toBeDefined();
  });

  it('adds a widget at the bottom with its default size', () => {
    const id = addWidget('risk', 'trade-blotter');
    expect(id).not.toBeNull();
    const lg = useDashboardStore.getState().pages.risk.layouts.lg ?? [];
    const item = lg.find((l) => l.i === id);
    expect(item).toMatchObject({ x: 0, w: 12, h: 10 });
    const others = lg.filter((l) => l.i !== id);
    expect(item?.y).toBe(Math.max(...others.map((l) => l.y + l.h)));
  });

  it('ignores unknown widget types', () => {
    expect(addWidget('risk', 'not-a-widget')).toBeNull();
  });

  it('removes and restores a widget at its original position (undo)', () => {
    const id = 'workstation-var-gauge';
    const before = useDashboardStore
      .getState()
      .pages.workstation.layouts.lg?.find((l) => l.i === id);
    const removed = removeWidget('workstation', id);
    expect(useWidgetStore.getState().instances[id]).toBeUndefined();
    expect(useDashboardStore.getState().pages.workstation.itemIds).not.toContain(id);
    if (!removed) throw new Error('expected a removal record');
    restoreWidget(removed);
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
    addWidget('performance', 'alerts-monitor');
    resetPage('performance');
    expect(captureSnapshot('performance')).toEqual(defaultSnapshot('performance'));
  });

  it('keeps layout JSON far below the 50 KB budget', () => {
    for (const page of ['workstation', 'risk', 'holdings', 'performance', 'research'] as const) {
      expect(snapshotBytes(captureSnapshot(page))).toBeLessThan(MAX_LAYOUT_BYTES / 10);
    }
  });

  it('tracks acknowledged alerts by id', () => {
    useDashboardStore.getState().acknowledgeAlerts(['a', 'b']);
    useDashboardStore.getState().acknowledgeAlerts(['b', 'c']);
    expect(useDashboardStore.getState().acknowledgedAlertIds).toEqual(['a', 'b', 'c']);
  });
});

describe('LayoutStore', () => {
  it('saves layouts with versions and restores older versions', () => {
    const s = useLayoutStore.getState();
    const id = s.saveNew('<b>Desk</b> view', captureSnapshot('risk'), '2026-10-20T10:00:00+05:30');
    addWidget('risk', 'holdings-table');
    const v2 = useLayoutStore
      .getState()
      .saveVersion(id, captureSnapshot('risk'), 'added holdings', '2026-10-20T11:00:00+05:30');
    expect(v2).toBe(2);
    const saved = useLayoutStore.getState().saved.find((l) => l.id === id);
    expect(saved?.name).toBe('Desk view');
    expect(saved?.versions.map((v) => v.version)).toEqual([1, 2]);
    const v1 = saved?.versions[0]?.snapshot;
    if (!v1) throw new Error('missing v1');
    applySnapshot('risk', v1);
    expect(useDashboardStore.getState().pages.risk.itemIds).toHaveLength(
      defaultSnapshot('risk').instances.length,
    );
  });

  it('removes a layout and clears the active marker', () => {
    const id = useLayoutStore
      .getState()
      .saveNew('Temp', captureSnapshot('risk'), '2026-10-20T10:00:00+05:30');
    expect(useLayoutStore.getState().activeByPage.risk).toBe(id);
    useLayoutStore.getState().remove(id);
    expect(useLayoutStore.getState().saved).toHaveLength(0);
    expect(useLayoutStore.getState().activeByPage.risk).toBeUndefined();
  });
});

describe('ThemeStore', () => {
  it('previews the builder draft and restores on cancel', () => {
    const t = useThemeStore.getState();
    t.openBuilder();
    useThemeStore.getState().setDraftToken('accent', '#ff00ff');
    expect(selectPaintedTheme(useThemeStore.getState()).tokens.accent).toBe('#ff00ff');
    useThemeStore.getState().closeBuilder();
    expect(selectPaintedTheme(useThemeStore.getState()).id).toBe(DEFAULT_THEME_ID);
  });

  it('saves a custom theme and makes it active', () => {
    useThemeStore.getState().openBuilder('porcelain');
    useThemeStore.getState().setDraftName('Desk light');
    const id = useThemeStore.getState().saveDraft();
    expect(useThemeStore.getState().activeThemeId).toBe(id);
    expect(useThemeStore.getState().customThemes[0]?.name).toBe('Desk light');
  });

  it('rejects invalid imported themes and accepts valid ones', () => {
    const bad = useThemeStore.getState().importTheme({ name: 'x', tokens: { bg: 'red' } });
    expect(bad.ok).toBe(false);
    const good = useThemeStore
      .getState()
      .importTheme({ ...MIDNIGHT_GRAPHITE, name: '<i>Night</i>' });
    expect(good.ok).toBe(true);
    expect(useThemeStore.getState().customThemes.at(-1)?.name).toBe('Night');
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
