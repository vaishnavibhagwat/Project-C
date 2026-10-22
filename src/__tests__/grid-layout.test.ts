import { describe, expect, it } from 'vitest';
import type { GridConfig } from '@/types';
import { BreakpointLayoutsSchema } from '@/store/schemas';
import {
  bottomOf,
  breakpointForViewport,
  columnsFor,
  convertLayouts,
  convertSize,
  DEFAULT_GRID_CONFIG,
  deriveLayout,
  findFreePosition,
  gridBreakpointsFor,
  LEGACY_GRID_CONFIG,
  resolveLayout,
  responsiveGridProps,
  rowsToPx,
} from '@/utils/gridLayout';
import { gridItem, hasOverlap } from './fixtures';

const item = gridItem;

describe('grid layout helpers', () => {
  it('derives breakpoint columns from the desktop column count', () => {
    expect(columnsFor(DEFAULT_GRID_CONFIG)).toEqual({ desktop: 12, tablet: 6, mobile: 1 });
    expect(columnsFor({ ...DEFAULT_GRID_CONFIG, cols: 24 })).toEqual({
      desktop: 24,
      tablet: 6,
      mobile: 1,
    });
    expect(columnsFor({ ...DEFAULT_GRID_CONFIG, cols: 6 }).desktop).toBe(6);
  });

  it('maps settings to react-grid-layout props', () => {
    const none: GridConfig = { cols: 16, rowHeight: 40, gap: 12, compaction: 'none' };
    expect(responsiveGridProps(none)).toMatchObject({
      cols: { desktop: 16, tablet: 6, mobile: 1 },
      rowHeight: 40,
      margin: [12, 12],
      compactType: null,
    });
    expect(responsiveGridProps(DEFAULT_GRID_CONFIG).compactType).toBe('vertical');
  });

  it('converts sizes between grids, keeping width share and pixel height', () => {
    expect(convertSize({ w: 6, h: 5 }, DEFAULT_GRID_CONFIG, DEFAULT_GRID_CONFIG)).toEqual({
      w: 6,
      h: 5,
    });
    // 10 legacy rows (352 px) are about 5 default rows (332 px).
    expect(convertSize({ w: 6, h: 10 }, LEGACY_GRID_CONFIG, DEFAULT_GRID_CONFIG)).toEqual({
      w: 6,
      h: 5,
    });
    const wide: GridConfig = { ...DEFAULT_GRID_CONFIG, cols: 24 };
    expect(convertSize({ w: 3, h: 4 }, DEFAULT_GRID_CONFIG, wide).w).toBe(6);
    // Minimums round up so a widget never gets less room than it asked for.
    const short: GridConfig = { ...DEFAULT_GRID_CONFIG, rowHeight: 30 };
    const min = convertSize({ w: 3, h: 4 }, DEFAULT_GRID_CONFIG, short, 'up');
    expect(rowsToPx(min.h, short)).toBeGreaterThanOrEqual(rowsToPx(4, DEFAULT_GRID_CONFIG));
  });

  it('pushes overlapping items down, giving the priority item its place', () => {
    const layout = [item('a', 0, 0, 6, 2), item('b', 0, 1, 6, 2)];
    expect(resolveLayout(layout, 'none')).toEqual([item('a', 0, 0, 6, 2), item('b', 0, 2, 6, 2)]);
    expect(resolveLayout(layout, 'none', 'b')).toEqual([
      item('a', 0, 3, 6, 2),
      item('b', 0, 1, 6, 2),
    ]);
  });

  it('closes gaps only with vertical compaction, and keeps the input order', () => {
    const gappy = [item('low', 0, 6, 4, 2), item('high', 4, 0, 4, 2)];
    expect(resolveLayout(gappy, 'none')).toEqual(gappy);
    expect(resolveLayout(gappy, 'vertical')).toEqual([
      item('low', 0, 0, 4, 2),
      item('high', 4, 0, 4, 2),
    ]);
  });

  it('converts whole layouts without creating overlaps', () => {
    const legacy = {
      desktop: [item('a', 0, 0, 12, 3), item('b', 0, 3, 6, 10), item('c', 6, 3, 6, 11)],
      tablet: [item('a', 0, 0, 6, 3)],
    };
    const converted = convertLayouts(legacy, LEGACY_GRID_CONFIG, DEFAULT_GRID_CONFIG);
    expect(converted.desktop).toEqual([
      item('a', 0, 0, 12, 2),
      item('b', 0, 2, 6, 5),
      item('c', 6, 2, 6, 6),
    ]);
    expect(converted.tablet).toEqual([item('a', 0, 0, 6, 2)]);
    const wide = convertLayouts(converted, DEFAULT_GRID_CONFIG, {
      ...DEFAULT_GRID_CONFIG,
      cols: 24,
    });
    expect(wide.desktop?.map((l) => [l.x, l.w])).toEqual([
      [0, 24],
      [0, 12],
      [12, 12],
    ]);
    expect(hasOverlap(wide.desktop ?? [])).toBe(false);
    expect(bottomOf(wide.desktop ?? [])).toBe(8);
    // Tablet keeps its fixed 6 columns when the desktop column count changes.
    expect(wide.tablet).toEqual(converted.tablet);
  });

  it('picks breakpoints by viewport width: desktop ≥ 1280, tablet 768-1279, mobile below', () => {
    expect(breakpointForViewport(3840)).toBe('desktop');
    expect(breakpointForViewport(1280)).toBe('desktop');
    expect(breakpointForViewport(1279)).toBe('tablet');
    expect(breakpointForViewport(768)).toBe('tablet');
    expect(breakpointForViewport(767)).toBe('mobile');
  });

  it('makes react-grid-layout select the viewport breakpoint for any grid width', () => {
    // react-grid-layout picks the widest breakpoint whose threshold is below the grid width.
    const pick = (thresholds: Record<string, number>, width: number) =>
      Object.entries(thresholds)
        .sort((a, b) => a[1] - b[1])
        .reduce((chosen, [name, min]) => (width > min ? name : chosen), 'mobile');
    for (const active of ['desktop', 'tablet', 'mobile'] as const) {
      for (const width of [300, 1180, 3740])
        expect(pick(gridBreakpointsFor(active), width)).toBe(active);
    }
  });

  it('finds the first free slot, else the bottom', () => {
    const layout = [item('a', 0, 0, 6, 4), item('b', 6, 0, 3, 4), item('c', 0, 4, 12, 2)];
    expect(findFreePosition(layout, 3, 3, 12)).toEqual({ x: 9, y: 0, w: 3, h: 3 });
    expect(findFreePosition(layout, 4, 3, 12)).toEqual({ x: 0, y: 6, w: 4, h: 3 });
    expect(findFreePosition([], 20, 2, 12)).toEqual({ x: 0, y: 0, w: 12, h: 2 });
    expect(findFreePosition(layout, 4, 2, 1)).toEqual({ x: 0, y: 6, w: 1, h: 2 });
  });

  it('reads layouts saved with the old lg/md/sm/xs keys', () => {
    const legacy = BreakpointLayoutsSchema.parse({
      lg: [item('a', 0, 0, 12, 2)],
      md: [item('a', 0, 0, 10, 2)],
      sm: [item('a', 0, 0, 6, 2)],
      xs: [item('a', 0, 0, 2, 2)],
    });
    expect(legacy).toEqual({ desktop: [item('a', 0, 0, 12, 2)], tablet: [item('a', 0, 0, 6, 2)] });
    const current = { desktop: [item('a', 0, 0, 12, 2)], mobile: [item('a', 0, 0, 1, 2)] };
    expect(BreakpointLayoutsSchema.parse(current)).toEqual(current);
  });

  it('derives tablet and mobile layouts from desktop: capped widths, no overlaps', () => {
    const desktop = [item('a', 0, 0, 6, 4), item('b', 6, 0, 3, 4), item('c', 9, 0, 3, 2)];
    const mobile = deriveLayout(desktop, 1, 'vertical');
    expect(mobile).toEqual([item('a', 0, 0, 1, 4), item('b', 0, 4, 1, 4), item('c', 0, 8, 1, 2)]);
    const tablet = deriveLayout(desktop, 6, 'vertical');
    expect(Math.max(...tablet.map((l) => l.x + l.w))).toBeLessThanOrEqual(6);
    expect(hasOverlap(tablet)).toBe(false);
  });
});
