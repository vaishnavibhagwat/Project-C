import { memo, useCallback, useMemo } from 'react';
import { Responsive, type Layout, type Layouts } from 'react-grid-layout';
import { useShallow } from 'zustand/react/shallow';
import { useElementSize } from '@/hooks/useElementSize';
import { widgetRegistry } from '@/registry/registry';
import { commitLayouts } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import type { BreakpointLayouts, GridItemLayout, PageId } from '@/types';
import { cx } from '@/utils/cx';
import {
  BREAKPOINT_KEYS,
  convertSize,
  DEFAULT_GRID_CONFIG,
  responsiveGridProps,
} from '@/utils/gridLayout';
import { DRAG_HANDLE_CLASS, NO_DRAG_CLASS, WidgetFrame } from './WidgetFrame';

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

/**
 * The drag-and-drop grid for one page. Children are memoised on the list of ids so that a
 * drag (which re-renders the grid) never re-renders widget bodies.
 */
function DashboardGridImpl({ page }: { page: PageId }) {
  const grid = useDashboardStore((s) => s.pages[page]);
  const locked = useDashboardStore((s) => s.locked);
  const gridConfig = useDashboardStore((s) => s.gridConfig);
  const gridProps = useMemo(() => responsiveGridProps(gridConfig), [gridConfig]);
  // Measure the container ourselves (instead of WidthProvider) so the grid first renders at
  // its real width: widgets lay out and render once rather than at a default width and again.
  const [containerRef, { width }] = useElementSize<HTMLDivElement>();
  const types = useWidgetStore(
    useShallow((s) => grid.itemIds.map((id) => s.instances[id]?.widgetId ?? '')),
  );

  // Apply registry min/max sizes at render time; only x/y/w/h are persisted. Widget sizes are
  // written for the default grid, so convert them to the current one.
  const layouts = useMemo<Layouts>(() => {
    const limits = new Map(
      grid.itemIds.map((id, k) => {
        const def = widgetRegistry.getWidget(types[k] ?? '');
        const min = convertSize(
          def?.minSize ?? { w: 2, h: 2 },
          DEFAULT_GRID_CONFIG,
          gridConfig,
          'up',
        );
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
            maxW: limit?.max?.w,
            maxH: limit?.max?.h,
          };
        });
    }
    return out;
  }, [grid.itemIds, grid.layouts, types, gridConfig, gridProps]);

  const onLayoutChange = useCallback(
    (_current: Layout[], all: Layouts) => {
      const next: BreakpointLayouts = {};
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

  const children = useMemo(
    () =>
      grid.itemIds.map((id) => (
        <div key={id}>
          <WidgetFrame page={page} instanceId={id} />
        </div>
      )),
    [grid.itemIds, page],
  );

  return (
    <div ref={containerRef} className="w-full">
      {width > 0 ? (
        <Responsive
          width={width}
          className={cx('layout', locked && 'is-locked')}
          layouts={layouts}
          breakpoints={gridProps.breakpoints}
          cols={gridProps.cols}
          rowHeight={gridProps.rowHeight}
          margin={gridProps.margin}
          containerPadding={gridProps.containerPadding}
          isDraggable={!locked}
          isResizable={!locked}
          draggableHandle={`.${DRAG_HANDLE_CLASS}`}
          draggableCancel={`.${NO_DRAG_CLASS}`}
          compactType={gridProps.compactType}
          useCSSTransforms
          onLayoutChange={onLayoutChange}
          resizeHandles={['se']}
        >
          {children}
        </Responsive>
      ) : null}
    </div>
  );
}

export const DashboardGrid = memo(DashboardGridImpl);
