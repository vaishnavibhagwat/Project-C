import type { Layout } from 'react-grid-layout';
import { isPlaceholder, PLACEHOLDER_SIZE } from '@/registry/placeholder';
import { widgetRegistry } from '@/registry/registry';
import type { GridConfig, GridItemLayout, GridSize } from '@/types';
import { convertSize, DEFAULT_GRID_CONFIG } from '@/utils/gridLayout';

export interface SizeLimits {
  min: GridSize;
  max?: GridSize;
}

/** Smallest size of an empty slot on the default grid. */
export const PLACEHOLDER_MIN: Readonly<GridSize> = { w: 2, h: 2 };

/**
 * A widget type's `minSize` and `maxSize` from its WidgetDefinition, converted from the default
 * grid to the current one (minimums round up, maximums round down).
 */
export function sizeLimitsFor(widgetId: string, grid: GridConfig): SizeLimits {
  const def = widgetRegistry.getWidget(widgetId);
  const minSize = isPlaceholder(widgetId) ? PLACEHOLDER_MIN : (def?.minSize ?? PLACEHOLDER_SIZE);
  return {
    min: convertSize(minSize, DEFAULT_GRID_CONFIG, grid, 'up'),
    max: def?.maxSize ? convertSize(def.maxSize, DEFAULT_GRID_CONFIG, grid, 'down') : undefined,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The layout handed to react-grid-layout. Every item carries its limits (minW/minH/maxW/maxH,
 * widths capped at the column count) so resizing stops at them, and a stored size outside
 * them (for example one saved under other grid settings) is clamped before it is shown.
 */
export function withSizeLimits(
  layout: readonly GridItemLayout[],
  limitsOf: (instanceId: string) => SizeLimits | undefined,
  cols: number,
): Layout[] {
  return layout.map((item) => {
    const limits = limitsOf(item.i);
    const minW = Math.min(limits?.min.w ?? 1, cols);
    const maxW = Math.max(minW, Math.min(limits?.max?.w ?? cols, cols));
    const minH = limits?.min.h ?? 1;
    const maxH = limits?.max ? Math.max(minH, limits.max.h) : undefined;
    const w = clamp(item.w, minW, maxW);
    const h = clamp(item.h, minH, maxH ?? Number.POSITIVE_INFINITY);
    return {
      i: item.i,
      x: clamp(item.x, 0, cols - w),
      y: item.y,
      w,
      h,
      minW,
      minH,
      maxW: limits?.max ? maxW : undefined,
      maxH,
    };
  });
}
