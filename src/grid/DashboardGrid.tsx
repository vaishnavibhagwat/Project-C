import { memo, useCallback, useMemo } from 'react';
import { Responsive, type Layout, type Layouts } from 'react-grid-layout';
import { useShallow } from 'zustand/react/shallow';
import { useElementSize } from '@/hooks/useElementSize';
import { getWidget } from '@/registry/registry';
import { commitLayouts } from '@/store/actions';
import { GRID_CONFIG, useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import type { Breakpoint, BreakpointLayouts, GridItemLayout, PageId } from '@/types';
import { cx } from '@/utils/cx';
import { DRAG_HANDLE_CLASS, NO_DRAG_CLASS, WidgetFrame } from './WidgetFrame';

const BREAKPOINT_KEYS: Breakpoint[] = ['lg', 'md', 'sm', 'xs'];

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
  // Measure the container ourselves (instead of WidthProvider) so the grid first renders at
  // its real width: widgets lay out and render once rather than at a default width and again.
  const [containerRef, { width }] = useElementSize<HTMLDivElement>();
  const types = useWidgetStore(
    useShallow((s) => grid.itemIds.map((id) => s.instances[id]?.widgetId ?? '')),
  );

  // Apply registry min/max sizes at render time; only x/y/w/h are persisted.
  const layouts = useMemo<Layouts>(() => {
    const limits = new Map(
      grid.itemIds.map((id, k) => {
        const def = getWidget(types[k] ?? '')?.definition;
        return [id, def] as const;
      }),
    );
    const out: Layouts = {};
    for (const bp of BREAKPOINT_KEYS) {
      const layout = grid.layouts[bp];
      if (!layout) continue;
      const cols = GRID_CONFIG.cols[bp];
      out[bp] = layout
        .filter((l) => grid.itemIds.includes(l.i))
        .map((l) => {
          const def = limits.get(l.i);
          return {
            ...l,
            minW: Math.min(def?.minSize.w ?? 2, cols),
            minH: def?.minSize.h ?? 3,
            maxW: def?.maxSize?.w,
            maxH: def?.maxSize?.h,
          };
        });
    }
    return out;
  }, [grid.itemIds, grid.layouts, types]);

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
          breakpoints={GRID_CONFIG.breakpoints}
          cols={GRID_CONFIG.cols}
          rowHeight={GRID_CONFIG.rowHeight}
          margin={GRID_CONFIG.margin}
          containerPadding={GRID_CONFIG.containerPadding}
          isDraggable={!locked}
          isResizable={!locked}
          draggableHandle={`.${DRAG_HANDLE_CLASS}`}
          draggableCancel={`.${NO_DRAG_CLASS}`}
          compactType={GRID_CONFIG.compactType}
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
