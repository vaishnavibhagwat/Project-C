import type { GridItemLayout, GridPosition, GridSize } from '@/types';
import { collides, findFreePosition } from '@/utils/gridLayout';

/**
 * Pure grid helpers used by the grid components. Positions and sizes are in grid units (columns
 * and rows). The lower-level layout maths (compaction, conversion between grids) lives in
 * src/utils/gridLayout.ts, which the stores also use.
 */

export interface SizeConstraints {
  min: GridSize;
  max?: GridSize;
}

/**
 * First place a w × h item fits on a layout with `cols` columns, scanning rows top to bottom
 * and columns left to right; the bottom-left corner when there is no gap.
 */
export function nextAvailablePosition(
  layout: readonly GridItemLayout[],
  size: GridSize,
  cols: number,
): GridPosition {
  return findFreePosition(layout, size.w, size.h, cols);
}

/** The first item in `layout` that overlaps `item` (ignoring `item` itself), or null. */
export function detectCollision(
  layout: readonly GridItemLayout[],
  item: GridItemLayout,
): GridItemLayout | null {
  return layout.find((other) => collides(other, item)) ?? null;
}

/**
 * True when `item` has whole-cell, positive size, sits inside the columns (and below row 0)
 * and overlaps nothing else in `layout`.
 */
export function isPositionValid(
  layout: readonly GridItemLayout[],
  item: GridItemLayout,
  cols: number,
): boolean {
  const whole = [item.x, item.y, item.w, item.h].every(Number.isInteger);
  const inside =
    item.x >= 0 && item.y >= 0 && item.w >= 1 && item.h >= 1 && item.x + item.w <= cols;
  return whole && inside && detectCollision(layout, item) === null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Fit an item to its size constraints and the column count: width and height are clamped to
 * the min/max (a minimum wider than the grid becomes the grid width), then x moves left so the
 * item stays inside the columns. y is left alone (compaction decides it).
 */
export function clampToConstraints<T extends GridPosition>(
  item: T,
  constraints: SizeConstraints | undefined,
  cols: number,
): T {
  const minW = Math.min(constraints?.min.w ?? 1, cols);
  const maxW = Math.max(minW, Math.min(constraints?.max?.w ?? cols, cols));
  const minH = Math.max(1, constraints?.min.h ?? 1);
  const maxH = constraints?.max ? Math.max(minH, constraints.max.h) : Number.POSITIVE_INFINITY;
  const w = clamp(Math.round(item.w), minW, maxW);
  return {
    ...item,
    x: clamp(Math.round(item.x), 0, cols - w),
    y: Math.max(0, Math.round(item.y)),
    w,
    h: clamp(Math.round(item.h), minH, maxH),
  };
}
