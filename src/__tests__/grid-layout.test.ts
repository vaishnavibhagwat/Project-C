import { describe, expect, it } from 'vitest';
import type { GridConfig } from '@/types';
import {
  bottomOf,
  columnsFor,
  convertLayouts,
  convertSize,
  DEFAULT_GRID_CONFIG,
  LEGACY_GRID_CONFIG,
  resolveLayout,
  responsiveGridProps,
  rowsToPx,
} from '@/utils/gridLayout';
import { gridItem, hasOverlap } from './fixtures';

const item = gridItem;

describe('grid layout helpers', () => {
  it('derives breakpoint columns from the desktop column count', () => {
    expect(columnsFor(DEFAULT_GRID_CONFIG)).toEqual({ lg: 12, md: 10, sm: 6, xs: 2 });
    expect(columnsFor({ ...DEFAULT_GRID_CONFIG, cols: 24 })).toEqual({
      lg: 24,
      md: 20,
      sm: 12,
      xs: 4,
    });
    expect(columnsFor({ ...DEFAULT_GRID_CONFIG, cols: 6 }).xs).toBe(1);
  });

  it('maps settings to react-grid-layout props', () => {
    const none: GridConfig = { cols: 16, rowHeight: 40, gap: 12, compaction: 'none' };
    expect(responsiveGridProps(none)).toMatchObject({
      cols: { lg: 16 },
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
      lg: [item('a', 0, 0, 12, 3), item('b', 0, 3, 6, 10), item('c', 6, 3, 6, 11)],
      sm: [item('a', 0, 0, 6, 3)],
    };
    const converted = convertLayouts(legacy, LEGACY_GRID_CONFIG, DEFAULT_GRID_CONFIG);
    expect(converted.lg).toEqual([
      item('a', 0, 0, 12, 2),
      item('b', 0, 2, 6, 5),
      item('c', 6, 2, 6, 6),
    ]);
    expect(converted.sm).toEqual([item('a', 0, 0, 6, 2)]);
    const wide = convertLayouts(converted, DEFAULT_GRID_CONFIG, {
      ...DEFAULT_GRID_CONFIG,
      cols: 24,
    });
    expect(wide.lg?.map((l) => [l.x, l.w])).toEqual([
      [0, 24],
      [0, 12],
      [12, 12],
    ]);
    expect(hasOverlap(wide.lg ?? [])).toBe(false);
    expect(bottomOf(wide.lg ?? [])).toBe(8);
  });
});
