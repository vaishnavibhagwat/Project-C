import { memo, useCallback, useEffect, useMemo } from 'react';
import { Responsive, WidthProvider, type Layout, type Layouts } from 'react-grid-layout';
import { useShallow } from 'zustand/react/shallow';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { isPlaceholder, PLACEHOLDER_SIZE } from '@/registry/placeholder';
import { widgetRegistry } from '@/registry/registry';
import { commitLayouts } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import type { BreakpointLayouts, GridItemLayout, GridSize, PageId } from '@/types';
import { cx } from '@/utils/cx';
import {
  BREAKPOINT_KEYS,
  breakpointForViewport,
  convertSize,
  DEFAULT_GRID_CONFIG,
  deriveLayout,
  gridBreakpointsFor,
  responsiveGridProps,
} from '@/utils/gridLayout';
import { GridItem } from './GridItem';
import { PlaceholderCard } from './PlaceholderCard';
import { DRAG_HANDLE_CLASS, NO_DRAG_CLASS, WidgetFrame } from './WidgetFrame';

/** react-grid-layout's Responsive grid, sized by WidthProvider (ResizeObserver). */
const ResponsiveGridLayout = WidthProvider(Responsive);

/** Smallest size of an empty slot on the default grid. */
const PLACEHOLDER_MIN: GridSize = { w: 2, h: 2 };

function toStored(layout: readonly Layout[]): GridItemLayout[] {
  return layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
}

function sameLayout(
  a: readonly GridItemLayout[] | undefined,
  b: readonly GridItemLayout[],
): boolean {
  if (!a || a.length !== b.length) return false;
  const byId = new Map(a.map((l) => [l.i, l]));
  return b.every((l) => {
    const o = byId.get(l.i);
    return o !== undefined && o.x === l.x && o.y === l.y && o.w === l.w && o.h === l.h;
  });
}

/** A widget or an empty slot, depending on the instance's type. */
const GridCell = memo(function GridCell({
  page,
  instanceId,
}: {
  page: PageId;
  instanceId: string;
}) {
  const placeholder = useWidgetStore((s) => isPlaceholder(s.instances[instanceId]?.widgetId ?? ''));
  return placeholder ? (
    <PlaceholderCard page={page} instanceId={instanceId} />
  ) : (
    <WidgetFrame page={page} instanceId={instanceId} />
  );
});

/**
 * The dashboard grid for one page. Three breakpoints, each with its own layout stored in
 * DashboardStore: desktop (viewport ≥ 1280 px, `gridConfig.cols` columns), tablet (768–1279
 * px, 6 columns) and mobile (< 768 px, 1 column, stacked). Columns, row height, gap and
 * compaction come from DashboardStore. Widgets push each other out of the way and never
 * overlap (`preventCollision` and `allowOverlap` are off).
 */
function GridContainerImpl({ page }: { page: PageId }) {
  const grid = useDashboardStore((s) => s.pages[page]);
  const locked = useDashboardStore((s) => s.locked);
  const gridConfig = useDashboardStore((s) => s.gridConfig);
  const setActiveBreakpoint = useDashboardStore((s) => s.setActiveBreakpoint);
  const types = useWidgetStore(
    useShallow((s) => grid.itemIds.map((id) => s.instances[id]?.widgetId ?? '')),
  );
  // The breakpoint follows the viewport (≥ 1280 px desktop, ≥ 768 px tablet), not the grid's
  // own width; WidthProvider only supplies the width the columns are laid out in.
  const breakpoint = breakpointForViewport(useViewportWidth());
  const gridProps = useMemo(
    () => responsiveGridProps(gridConfig, gridBreakpointsFor(breakpoint)),
    [gridConfig, breakpoint],
  );

  useEffect(() => {
    setActiveBreakpoint(breakpoint);
  }, [breakpoint, setActiveBreakpoint]);

  // Each breakpoint keeps its own stored layout. The first time one is shown, derive it from
  // the desktop layout and store it; from then on it changes independently.
  const missing = grid.layouts[breakpoint] === undefined;
  useEffect(() => {
    if (!missing) return;
    const source = grid.layouts.desktop ?? [];
    const derived = deriveLayout(source, gridProps.cols[breakpoint], gridConfig.compaction);
    commitLayouts(page, { ...grid.layouts, [breakpoint]: derived });
  }, [missing, breakpoint, grid.layouts, gridProps.cols, gridConfig.compaction, page]);

  // Apply per-widget min/max sizes at render time; only x/y/w/h are persisted. Sizes are
  // written for the default grid, so convert them to the current one.
  const layouts = useMemo<Layouts>(() => {
    const limits = new Map(
      grid.itemIds.map((id, k) => {
        const type = types[k] ?? '';
        const def = widgetRegistry.getWidget(type);
        const minSize = isPlaceholder(type) ? PLACEHOLDER_MIN : (def?.minSize ?? PLACEHOLDER_SIZE);
        const min = convertSize(minSize, DEFAULT_GRID_CONFIG, gridConfig, 'up');
        const max = def?.maxSize
          ? convertSize(def.maxSize, DEFAULT_GRID_CONFIG, gridConfig, 'down')
          : undefined;
        return [id, { min, max }] as const;
      }),
    );
    const out: Layouts = {};
    for (const bp of BREAKPOINT_KEYS) {
      const layout = grid.layouts[bp];
      if (!layout) continue;
      const cols = gridProps.cols[bp];
      out[bp] = layout
        .filter((l) => grid.itemIds.includes(l.i))
        .map((l) => {
          const limit = limits.get(l.i);
          return {
            ...l,
            minW: Math.min(limit?.min.w ?? 1, cols),
            minH: limit?.min.h ?? 1,
            maxW: limit?.max ? Math.min(limit.max.w, cols) : undefined,
            maxH: limit?.max?.h,
          };
        });
    }
    return out;
  }, [grid.itemIds, grid.layouts, types, gridConfig, gridProps]);

  const onLayoutChange = useCallback(
    (_current: Layout[], all: Layouts) => {
      const next: BreakpointLayouts = { ...grid.layouts };
      let changed = false;
      for (const bp of BREAKPOINT_KEYS) {
        const layout = all[bp];
        if (!layout) continue;
        const stored = toStored(layout);
        next[bp] = stored;
        if (!sameLayout(grid.layouts[bp], stored)) changed = true;
      }
      if (changed) commitLayouts(page, next);
    },
    [grid.layouts, page],
  );

  // Children depend only on the ids, so a drag (which re-renders the grid) never re-renders
  // widget bodies.
  const children = useMemo(
    () =>
      grid.itemIds.map((id) => (
        <GridItem key={id} instanceId={id}>
          <GridCell page={page} instanceId={id} />
        </GridItem>
      )),
    [grid.itemIds, page],
  );

  // No `measureBeforeMount`: in react-grid-layout 1.5 it measures a temporary <div> that is
  // then replaced, and its ResizeObserver reports the removed node as 0 px wide, which
  // collapses every widget. Without it WidthProvider observes the grid's own root.
  return (
    <ResponsiveGridLayout
      className={cx('layout', locked && 'is-locked')}
      layouts={layouts}
      breakpoints={gridProps.breakpoints}
      cols={gridProps.cols}
      rowHeight={gridProps.rowHeight}
      margin={gridProps.margin}
      containerPadding={gridProps.containerPadding}
      compactType={gridProps.compactType}
      preventCollision={false}
      allowOverlap={false}
      isDraggable={!locked}
      isResizable={!locked}
      draggableHandle={`.${DRAG_HANDLE_CLASS}`}
      draggableCancel={`.${NO_DRAG_CLASS}`}
      useCSSTransforms
      onLayoutChange={onLayoutChange}
      resizeHandles={['se']}
    >
      {children}
    </ResponsiveGridLayout>
  );
}

export const GridContainer = memo(GridContainerImpl);
