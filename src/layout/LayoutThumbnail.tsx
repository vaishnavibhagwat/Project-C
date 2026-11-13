import { memo } from 'react';
import { isPlaceholder } from '@/registry/placeholder';
import { widgetRegistry } from '@/registry/registry';
import { cssColor } from '@/theme/themes';
import type { PageSnapshot, ThemeTokenKey, WidgetCategory } from '@/types';
import { DEFAULT_GRID_CONFIG } from '@/utils/gridLayout';

/** One colour per widget category, so the thumbnail hints at what is where. */
const CATEGORY_COLOR: Record<WidgetCategory, ThemeTokenKey> = {
  CHART: 'chart1',
  TABLE: 'chart2',
  FEED: 'chart3',
  GAUGE: 'chart4',
  ANALYSIS: 'chart5',
};

export interface ThumbnailBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: ThemeTokenKey;
}

/** The desktop positions of a snapshot's widgets, with the grid size they span. */
export function thumbnailBoxes(snapshot: PageSnapshot): {
  boxes: ThumbnailBox[];
  cols: number;
  rows: number;
} {
  const cols = snapshot.grid?.cols ?? DEFAULT_GRID_CONFIG.cols;
  const placed = new Map((snapshot.layouts.desktop ?? []).map((item) => [item.i, item]));
  const boxes = snapshot.instances.map((instance): ThumbnailBox => {
    const { x, y, w, h } = placed.get(instance.instanceId) ?? instance.position;
    const category = widgetRegistry.getWidget(instance.widgetId)?.category;
    const color: ThemeTokenKey = isPlaceholder(instance.widgetId)
      ? 'border'
      : category
        ? CATEGORY_COLOR[category]
        : 'textSubtle';
    return { id: instance.instanceId, x, y, w, h, color };
  });
  const rows = Math.max(4, ...boxes.map((b) => b.y + b.h));
  return { boxes, cols, rows };
}

/**
 * Mini preview of a layout: one rectangle per widget at its desktop grid position, coloured by
 * widget category. Decorative (the card says how many widgets there are), so hidden from
 * assistive technology.
 */
export const LayoutThumbnail = memo(function LayoutThumbnail({
  snapshot,
  className,
}: {
  snapshot: PageSnapshot;
  className?: string;
}) {
  const { boxes, cols, rows } = thumbnailBoxes(snapshot);
  const gap = 0.25;
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="xMidYMin meet"
      aria-hidden="true"
      focusable="false"
      data-testid="layout-thumbnail"
      className={className}
    >
      <rect x={0} y={0} width={cols} height={rows} fill={cssColor('bg')} />
      {boxes.map((b) => (
        <rect
          key={b.id}
          x={b.x + gap}
          y={b.y + gap}
          width={Math.max(b.w - gap * 2, 0.2)}
          height={Math.max(b.h - gap * 2, 0.2)}
          rx={0.3}
          fill={cssColor(b.color, 0.35)}
          stroke={cssColor(b.color)}
          strokeWidth={0.08}
        />
      ))}
    </svg>
  );
});
