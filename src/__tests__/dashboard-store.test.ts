import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSnapshot } from '@/registry/pages';
import { migrateDashboardState, useDashboardStore } from '@/store/dashboardStore';
import type { GridConfig, GridItemLayout, PageId } from '@/types';
import { DEFAULT_GRID_CONFIG, rowsToPx } from '@/utils/gridLayout';
import { gridItem as item, hasOverlap } from './fixtures';

const initial = useDashboardStore.getState();
const store = () => useDashboardStore.getState();
const desktop = (page: PageId = 'research') => store().pages[page].layouts.desktop ?? [];
const find = (id: string, page: PageId = 'research') => desktop(page).find((l) => l.i === id);

/** Research page replaced with a small, known layout: a full-width bar over two halves. */
function useTestPage() {
  store().replacePage('research', {
    itemIds: ['a', 'b', 'c'],
    layouts: {
      desktop: [item('a', 0, 0, 12, 2), item('b', 0, 2, 6, 4), item('c', 6, 2, 6, 4)],
      tablet: [item('a', 0, 0, 6, 2), item('b', 0, 2, 3, 4), item('c', 3, 2, 3, 4)],
    },
  });
}

beforeEach(() => useDashboardStore.setState(initial, true));

describe('DashboardStore grid settings', () => {
  it('starts with the defaults from the brief', () => {
    expect(store().gridConfig).toEqual({
      cols: 12,
      rowHeight: 60,
      gap: 8,
      compaction: 'vertical',
    });
  });

  it.each<Partial<GridConfig>>([
    { cols: 6 },
    { cols: 24 },
    { rowHeight: 30 },
    { rowHeight: 100 },
    { gap: 4 },
    { gap: 20 },
    { compaction: 'none' },
  ])('setGridConfig accepts %o', (patch) => {
    expect(store().setGridConfig(patch)).toBe(true);
    expect(store().gridConfig).toMatchObject(patch);
  });

  it.each<Partial<GridConfig>>([
    { cols: 5 },
    { cols: 25 },
    { cols: 12.5 },
    { rowHeight: 29 },
    { rowHeight: 101 },
    { gap: 3 },
    { gap: 21 },
  ])('setGridConfig rejects %o and changes nothing', (patch) => {
    const before = store();
    expect(store().setGridConfig(patch)).toBe(false);
    expect(store().gridConfig).toBe(before.gridConfig);
    expect(store().pages).toBe(before.pages);
  });

  it('converts every page when the grid changes, keeping width share and pixel height', () => {
    const before = desktop('workstation');
    store().setGridConfig({ cols: 24, rowHeight: 30 });
    const after = desktop('workstation');
    for (const old of before) {
      const next = after.find((l) => l.i === old.i);
      if (!next) throw new Error(`missing ${old.i}`);
      expect(next.w).toBe(old.w * 2);
      expect(next.x).toBe(old.x * 2);
      const oldPx = rowsToPx(old.h, DEFAULT_GRID_CONFIG);
      const newPx = rowsToPx(next.h, store().gridConfig);
      expect(Math.abs(newPx - oldPx)).toBeLessThanOrEqual(38 / 2);
    }
    expect(hasOverlap(after)).toBe(false);
  });

  it('resetGridConfig returns to the defaults and the original layout', () => {
    const original = desktop('workstation');
    store().setGridConfig({ cols: 24, compaction: 'none' });
    store().resetGridConfig();
    expect(store().gridConfig).toEqual(DEFAULT_GRID_CONFIG);
    expect(desktop('workstation')).toEqual(original);
  });

  it('leaves gaps with compaction "none" and closes them when switched back to vertical', () => {
    useTestPage();
    store().setGridConfig({ compaction: 'none' });
    store().moveWidget('research', 'c', { x: 6, y: 10 });
    expect(find('c')?.y).toBe(10);
    store().setGridConfig({ compaction: 'vertical' });
    expect(find('c')?.y).toBe(2);
  });
});

describe('DashboardStore widget placement', () => {
  it('addWidget places the widget at its desktop position and moves overlapping ones down', () => {
    useTestPage();
    store().addWidget('research', item('d', 0, 0, 6, 3));
    expect(store().pages.research.itemIds).toEqual(['a', 'b', 'c', 'd']);
    expect(find('d')).toEqual(item('d', 0, 0, 6, 3));
    expect(find('a')?.y).toBe(3);
    expect(hasOverlap(desktop())).toBe(false);
  });

  it('addWidget appends to other breakpoints, clamps to the columns and ignores duplicates', () => {
    useTestPage();
    store().addWidget('research', item('wide', 10, 99, 40, 2));
    expect(find('wide')).toMatchObject({ x: 0, w: 12 });
    const tablet = store().pages.research.layouts.tablet?.find((l) => l.i === 'wide');
    expect(tablet).toMatchObject({ x: 0, y: 6, w: 6, h: 2 });
    store().addWidget('research', item('wide', 0, 0, 4, 4));
    expect(store().pages.research.itemIds.filter((id) => id === 'wide')).toHaveLength(1);
  });

  it('removeWidget removes it from every breakpoint and closes the gap', () => {
    useTestPage();
    store().removeWidget('research', 'a');
    expect(store().pages.research.itemIds).toEqual(['b', 'c']);
    expect(desktop()).toEqual([item('b', 0, 0, 6, 4), item('c', 6, 0, 6, 4)]);
    expect(store().pages.research.layouts.tablet?.some((l) => l.i === 'a')).toBe(false);
  });

  it('restoreWidget puts a removed widget back where it was (undo)', () => {
    useTestPage();
    const original = store().pages.research;
    const saved = {
      desktop: find('a'),
      tablet: original.layouts.tablet?.find((l) => l.i === 'a'),
    };
    store().removeWidget('research', 'a');
    store().restoreWidget('research', 'a', saved);
    // Order in the arrays does not matter to the grid; positions do.
    const byId = (layout: readonly GridItemLayout[] = []) =>
      [...layout].sort((x, y) => x.i.localeCompare(y.i));
    expect(byId(desktop())).toEqual(byId(original.layouts.desktop));
    expect(byId(store().pages.research.layouts.tablet)).toEqual(byId(original.layouts.tablet));
    expect(store().pages.research.itemIds).toContain('a');
  });

  it('moveWidget moves a widget and the others make room', () => {
    useTestPage();
    store().moveWidget('research', 'c', { x: 0, y: 0 });
    expect(find('c')).toEqual(item('c', 0, 0, 6, 4));
    expect(find('a')?.y).toBe(4);
    expect(hasOverlap(desktop())).toBe(false);
  });

  it('moveWidget keeps the widget inside the grid and only touches the given breakpoint', () => {
    useTestPage();
    const tablet = store().pages.research.layouts.tablet;
    store().moveWidget('research', 'b', { x: 20, y: -5 });
    expect(find('b')?.x).toBe(6);
    expect(store().pages.research.layouts.tablet).toBe(tablet);
    store().moveWidget('research', 'b', { x: 0, y: 0 }, 'tablet');
    expect(store().pages.research.layouts.tablet?.find((l) => l.i === 'b')).toMatchObject({
      x: 0,
      y: 0,
    });
  });

  it('moveWidget and resizeWidget ignore unknown widgets and breakpoints', () => {
    useTestPage();
    const pages = store().pages;
    store().moveWidget('research', 'ghost', { x: 1, y: 1 });
    store().resizeWidget('research', 'a', { w: 2, h: 2 }, 'mobile');
    expect(store().pages).toBe(pages);
  });

  it('resizeWidget grows a widget and pushes neighbours down', () => {
    useTestPage();
    store().resizeWidget('research', 'a', { w: 12, h: 5 });
    expect(find('a')).toEqual(item('a', 0, 0, 12, 5));
    expect(find('b')?.y).toBe(5);
    expect(find('c')?.y).toBe(5);
  });

  it('resizeWidget keeps the widget inside the columns and at least one cell', () => {
    useTestPage();
    store().resizeWidget('research', 'c', { w: 12, h: 0 });
    expect(find('c')).toMatchObject({ x: 6, w: 6, h: 1 });
  });
});

describe('DashboardStore other actions', () => {
  it('setLayouts replaces a page layout as given', () => {
    const layouts = { desktop: [item('research-research-feed', 0, 0, 12, 4)] };
    store().setLayouts('research', layouts);
    expect(store().pages.research.layouts).toEqual(layouts);
  });

  it('replacePage swaps the whole page', () => {
    const grid = { itemIds: ['x'], layouts: { desktop: [item('x', 0, 0, 4, 4)] } };
    store().replacePage('holdings', grid);
    expect(store().pages.holdings).toEqual(grid);
  });

  it('setActiveBreakpoint records the breakpoint on screen (not persisted)', () => {
    expect(store().activeBreakpoint).toBe('desktop');
    store().setActiveBreakpoint('mobile');
    expect(store().activeBreakpoint).toBe('mobile');
  });

  it('setLocked toggles the grid lock', () => {
    store().setLocked(true);
    expect(store().locked).toBe(true);
    store().setLocked(false);
    expect(store().locked).toBe(false);
  });

  it('setDisplayCurrency switches between INR and USD', () => {
    store().setDisplayCurrency('USD');
    expect(store().displayCurrency).toBe('USD');
  });

  it('acknowledgeAlerts keeps unique ids and at most 500', () => {
    store().acknowledgeAlerts(['a', 'b']);
    store().acknowledgeAlerts(['b', 'c']);
    expect(store().acknowledgedAlertIds).toEqual(['a', 'b', 'c']);
    store().acknowledgeAlerts(Array.from({ length: 600 }, (_, i) => `id-${i}`));
    expect(store().acknowledgedAlertIds).toHaveLength(500);
    expect(store().acknowledgedAlertIds.at(-1)).toBe('id-599');
  });
});

describe('DashboardStore persistence', () => {
  const legacyWorkstation = {
    itemIds: ['workstation-portfolio-overview', 'workstation-nav-performance'],
    layouts: {
      lg: [
        item('workstation-portfolio-overview', 0, 0, 12, 3),
        item('workstation-nav-performance', 0, 3, 6, 10),
      ],
    },
  };
  const v1 = {
    pages: { workstation: legacyWorkstation },
    locked: true,
    displayCurrency: 'USD',
    readAlertIds: ['risk-var99'],
  };

  it('converts version 1 layouts from 28 px rows to the default grid', () => {
    const migrated = migrateDashboardState(v1, 1);
    expect(migrated?.gridConfig).toEqual(DEFAULT_GRID_CONFIG);
    expect(migrated?.pages.workstation?.layouts.desktop).toEqual([
      item('workstation-portfolio-overview', 0, 0, 12, 2),
      item('workstation-nav-performance', 0, 2, 6, 5),
    ]);
    expect(migrated?.acknowledgedAlertIds).toEqual(['risk-var99']);
    expect(migrateDashboardState({ nonsense: true }, 1)).toBeNull();
  });

  it('rehydrates version 1 storage and fills pages it did not have', async () => {
    localStorage.setItem('meridian:dashboard', JSON.stringify({ state: v1, version: 1 }));
    await useDashboardStore.persist.rehydrate();
    expect(store().locked).toBe(true);
    expect(store().pages.workstation.layouts.desktop?.[1]).toEqual(
      item('workstation-nav-performance', 0, 2, 6, 5),
    );
    expect(store().pages.risk.layouts.desktop).toEqual(defaultSnapshot('risk').layouts.desktop);
  });
});
