import type {
  Breakpoint,
  BreakpointLayouts,
  GridCompaction,
  GridConfig,
  GridItemLayout,
  GridPosition,
  GridSize,
} from '@/types';

/** Minimum container width (px) for each breakpoint. */
export const GRID_BREAKPOINTS: Readonly<Record<Breakpoint, number>> = {
  lg: 1200,
  md: 960,
  sm: 640,
  xs: 0,
};

export const BREAKPOINT_KEYS: readonly Breakpoint[] = ['lg', 'md', 'sm', 'xs'];

/** Allowed ranges for the user-adjustable grid settings. */
export const GRID_LIMITS = {
  cols: { min: 6, max: 24 },
  rowHeight: { min: 30, max: 100 },
  gap: { min: 4, max: 20 },
} as const;

/** Defaults from the brief. Widget sizes and the default pages are written in these units. */
export const DEFAULT_GRID_CONFIG: Readonly<GridConfig> = {
  cols: 12,
  rowHeight: 60,
  gap: 8,
  compaction: 'vertical',
};

/** The grid used before grid settings existed. Older saved layouts are in these units. */
export const LEGACY_GRID_CONFIG: Readonly<GridConfig> = {
  cols: 12,
  rowHeight: 28,
  gap: 8,
  compaction: 'vertical',
};

/** Columns per breakpoint, derived from the desktop column count (12 gives 12/10/6/2). */
export function columnsFor(config: GridConfig): Record<Breakpoint, number> {
  const { cols } = config;
  return {
    lg: cols,
    md: Math.round((cols * 5) / 6),
    sm: Math.round(cols / 2),
    xs: Math.max(1, Math.round(cols / 6)),
  };
}

/** Props for react-grid-layout's Responsive component. */
export function responsiveGridProps(config: GridConfig) {
  return {
    breakpoints: GRID_BREAKPOINTS,
    cols: columnsFor(config),
    rowHeight: config.rowHeight,
    margin: [config.gap, config.gap] satisfies [number, number],
    containerPadding: [0, 0] satisfies [number, number],
    compactType: config.compaction === 'vertical' ? ('vertical' as const) : null,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Distance from one row's top to the next row's top, px. */
function pitch(config: GridConfig): number {
  return config.rowHeight + config.gap;
}

/** Pixel height of an item `h` rows tall (rows plus the gaps between them). */
export function rowsToPx(h: number, config: GridConfig): number {
  return h * pitch(config) - config.gap;
}

/** Rows (fractional) needed for a pixel height. */
function pxToRows(px: number, config: GridConfig): number {
  return (px + config.gap) / pitch(config);
}

export type Rounding = 'nearest' | 'up' | 'down';

function roundBy(value: number, rounding: Rounding): number {
  // The epsilon keeps exact conversions (e.g. same grid) from tipping over.
  if (rounding === 'up') return Math.ceil(value - 1e-9);
  if (rounding === 'down') return Math.floor(value + 1e-9);
  return Math.round(value);
}

/**
 * Convert a desktop size between grids, keeping its width share and pixel height.
 * Use 'up' for minimum sizes (never smaller than intended) and 'down' for maximum sizes.
 */
export function convertSize(
  size: GridSize,
  from: GridConfig,
  to: GridConfig,
  rounding: Rounding = 'nearest',
): GridSize {
  return {
    w: clamp(roundBy((size.w * to.cols) / from.cols, rounding), 1, to.cols),
    h: Math.max(1, roundBy(pxToRows(rowsToPx(size.h, from), to), rounding)),
  };
}

/** Convert one item between grids, given the column counts of its breakpoint. */
function convertItem<T extends GridPosition>(
  item: T,
  fromCols: number,
  toCols: number,
  from: GridConfig,
  to: GridConfig,
): T {
  const w = clamp(Math.round((item.w * toCols) / fromCols), 1, toCols);
  return {
    ...item,
    x: clamp(Math.round((item.x * toCols) / fromCols), 0, toCols - w),
    y: Math.max(0, Math.round((item.y * pitch(from)) / pitch(to))),
    w,
    h: Math.max(1, Math.round(pxToRows(rowsToPx(item.h, from), to))),
  };
}

/** Convert a desktop (lg) position between grids. */
export function convertPosition(
  position: GridPosition,
  from: GridConfig,
  to: GridConfig,
): GridPosition {
  return convertItem(position, from.cols, to.cols, from, to);
}

/**
 * Convert every breakpoint's layout between grids so widgets keep their relative width and
 * roughly their pixel height, then settle overlaps caused by rounding (and compact, if `to`
 * compacts).
 */
export function convertLayouts(
  layouts: BreakpointLayouts,
  from: GridConfig,
  to: GridConfig,
): BreakpointLayouts {
  const fromCols = columnsFor(from);
  const toCols = columnsFor(to);
  const out: BreakpointLayouts = {};
  for (const bp of BREAKPOINT_KEYS) {
    const layout = layouts[bp];
    if (!layout) continue;
    const converted = layout.map((item) => convertItem(item, fromCols[bp], toCols[bp], from, to));
    out[bp] = resolveLayout(converted, to.compaction);
  }
  return out;
}

/** Lowest free row in a layout, so new widgets land at the bottom. */
export function bottomOf(layout: readonly GridItemLayout[]): number {
  return layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
}

function collides(a: GridItemLayout, b: GridItemLayout): boolean {
  return a.i !== b.i && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function byPosition(a: GridItemLayout, b: GridItemLayout): number {
  return a.y - b.y || a.x - b.x;
}

/**
 * Make a layout valid: no two items overlap, and with 'vertical' compaction no item has free
 * space above it. Items keep their place in reading order (top to bottom, left to right) and
 * later items move down out of the way. `priorityId` (a widget that was just moved, resized
 * or added) is placed first, so the others make room for it, as react-grid-layout does.
 * The result keeps the input's order.
 */
export function resolveLayout(
  layout: readonly GridItemLayout[],
  compaction: GridCompaction,
  priorityId?: string,
): GridItemLayout[] {
  const ordered = [...layout].sort((a, b) => {
    if (a.i === priorityId) return -1;
    if (b.i === priorityId) return 1;
    return byPosition(a, b);
  });

  const settled: GridItemLayout[] = [];
  for (const item of ordered) {
    const next = { ...item };
    let hit = settled.find((other) => collides(other, next));
    while (hit) {
      next.y = hit.y + hit.h;
      hit = settled.find((other) => collides(other, next));
    }
    settled.push(next);
  }

  let result = settled;
  if (compaction === 'vertical') {
    const compacted: GridItemLayout[] = [];
    for (const item of [...settled].sort(byPosition)) {
      const next = { ...item, y: Math.min(item.y, bottomOf(compacted)) };
      while (
        next.y > 0 &&
        !compacted.some((other) => collides(other, { ...next, y: next.y - 1 }))
      ) {
        next.y -= 1;
      }
      compacted.push(next);
    }
    result = compacted;
  }

  const byId = new Map(result.map((item) => [item.i, item]));
  return layout.map((item) => byId.get(item.i) ?? item);
}
