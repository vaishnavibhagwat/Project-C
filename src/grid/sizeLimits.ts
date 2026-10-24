import type { Layout } from 'react-grid-layout';
import { isPlaceholder, PLACEHOLDER_SIZE } from '@/registry/placeholder';
import { widgetRegistry } from '@/registry/registry';
import type { GridConfig, GridItemLayout, GridSize } from '@/types';
import { convertSize, DEFAULT_GRID_CONFIG } from '@/utils/gridLayout';
import { clampToConstraints } from './utils';

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
    const fitted = clampToConstraints(
      { i: item.i, x: item.x, y: item.y, w: item.w, h: item.h },
      limits,
      cols,
    );
    const minW = Math.min(limits?.min.w ?? 1, cols);
    const minH = limits?.min.h ?? 1;
    return {
      ...fitted,
      minW,
      minH,
      maxW: limits?.max ? Math.max(minW, Math.min(limits.max.w, cols)) : undefined,
      maxH: limits?.max ? Math.max(minH, limits.max.h) : undefined,
    };
  });
}
