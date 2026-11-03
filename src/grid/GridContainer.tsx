import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Responsive, WidthProvider, type Layout, type Layouts } from 'react-grid-layout';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/components/Toast';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { isPlaceholder } from '@/registry/placeholder';
import { widgetRegistry } from '@/registry/registry';
import {
  COLLAPSED_ROWS,
  commitLayouts,
  dropWidgetOnPage,
  MAX_WIDGETS_PER_PAGE,
} from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import type { BreakpointLayouts, GridItemLayout, PageId } from '@/types';
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
import { DROPPING_ITEM_ID, draggedCatalogueWidget, endCatalogueDrag } from './catalogueDrag';
import { GridItem } from './GridItem';
import { PlaceholderCard } from './PlaceholderCard';
import { sizeLimitsFor, withSizeLimits, type SizeLimits } from './sizeLimits';
import { DRAG_HANDLE_CLASS, NO_DRAG_CLASS, WidgetFrame } from './WidgetFrame';

/** react-grid-layout's Responsive grid, sized by WidthProvider (ResizeObserver). */
const ResponsiveGridLayout = WidthProvider(Responsive);

type ResizeHandle = 'se' | 'sw' | 'ne' | 'nw' | 'n' | 's' | 'e' | 'w';

/** Every corner and edge; the bottom-right one is always visible (see global.css). */
export const RESIZE_HANDLES: ResizeHandle[] = ['se', 'sw', 'ne', 'nw', 'n', 's', 'e', 'w'];

/** How long after mount before moves animate, so widgets do not slide in on first paint. */
const SETTLE_MS = 400;

/** Drop preview before the dragged widget's own size is known. */
const DROPPING_ITEM = { i: DROPPING_ITEM_ID, w: 4, h: 4 };

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

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
  const collapsed = useWidgetStore(
    useShallow((s) => grid.itemIds.map((id) => s.instances[id]?.collapsed !== undefined)),
  );
  // The breakpoint follows the viewport (≥ 1280 px desktop, ≥ 768 px tablet), not the grid's
  // own width; WidthProvider only supplies the width the columns are laid out in.
  const breakpoint = breakpointForViewport(useViewportWidth());
  const density = useDashboardStore((s) => s.density);
  const gridProps = useMemo(
    () => responsiveGridProps(gridConfig, gridBreakpointsFor(breakpoint), density),
    [gridConfig, breakpoint, density],
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

  // Each widget's minSize/maxSize from its WidgetDefinition, applied at render time (only
  // x/y/w/h are persisted). Sizes are written for the default grid, so they are converted.
  // A collapsed widget is held at its header height and cannot be resized until expanded.
  const layouts = useMemo<Layouts>(() => {
    const limits = new Map(
      grid.itemIds.map((id, k) => {
        const own = sizeLimitsFor(types[k] ?? '', gridConfig);
        const held: SizeLimits = {
          min: { w: own.min.w, h: COLLAPSED_ROWS },
          max: { w: own.max?.w ?? gridConfig.cols, h: COLLAPSED_ROWS },
        };
        return [id, collapsed[k] ? held : own] as const;
      }),
    );
    const frozen = new Set(grid.itemIds.filter((_, k) => collapsed[k]));
    const out: Layouts = {};
    for (const bp of BREAKPOINT_KEYS) {
      const layout = grid.layouts[bp];
      if (!layout) continue;
      out[bp] = withSizeLimits(
        layout.filter((l) => grid.itemIds.includes(l.i)),
        (id) => limits.get(id),
        gridProps.cols[bp],
      ).map((item) => (frozen.has(item.i) ? { ...item, isResizable: false } : item));
    }
    return out;
  }, [grid.itemIds, grid.layouts, types, collapsed, gridConfig, gridProps]);

  // Store a finished drag or resize. Nothing is written while the pointer moves.
  const commitBreakpoint = useCallback(
    (layout: Layout[], label: string) => {
      const stored = toStored(layout);
      if (sameLayout(grid.layouts[breakpoint], stored)) return;
      commitLayouts(page, { ...grid.layouts, [breakpoint]: stored }, label);
    },
    [grid.layouts, breakpoint, page],
  );

  // Departure indicator: the dragged widget's starting box, shown once it actually moves.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragOrigin = useRef<Box | null>(null);
  const [departure, setDeparture] = useState<Box | null>(null);

  const onDragStart = useCallback(
    (_l: Layout[], _o: Layout, item: Layout, _p: Layout, _e: MouseEvent, element: HTMLElement) => {
      // A catalogue drop preview is not a widget leaving its place.
      if (item.i === DROPPING_ITEM_ID) {
        dragOrigin.current = null;
        return;
      }
      const wrapper = wrapperRef.current?.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      dragOrigin.current = wrapper
        ? {
            left: rect.left - wrapper.left,
            top: rect.top - wrapper.top,
            width: rect.width,
            height: rect.height,
          }
        : null;
    },
    [],
  );
  // Called for every pointer move; after the first it returns the same state, so React skips it.
  const onDrag = useCallback(() => setDeparture((shown) => shown ?? dragOrigin.current), []);
  const onDragStop = useCallback(
    (layout: Layout[]) => {
      dragOrigin.current = null;
      setDeparture(null);
      commitBreakpoint(layout, 'Move widget');
    },
    [commitBreakpoint],
  );
  const onResizeStop = useCallback(
    (layout: Layout[]) => commitBreakpoint(layout, 'Resize widget'),
    [commitBreakpoint],
  );

  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Safety net for changes react-grid-layout makes on its own (never during a drag: it only
  // reports after a drop, which commitBreakpoint has already stored).
  const onLayoutChange = useCallback(
    (current: Layout[], all: Layouts) => {
      // While a catalogue widget is dragged over the grid, its drop preview is in the layout.
      // Nothing is stored until it is dropped (onDrop).
      if (current.some((l) => l.i === DROPPING_ITEM_ID)) return;
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

  // Drag-to-add from the widget catalogue. The preview takes the dragged widget's default size;
  // anything else dragged over the grid (files, text) is refused.
  const notify = useToast();
  const full = grid.itemIds.length >= MAX_WIDGETS_PER_PAGE;
  const onDropDragOver = useCallback(() => {
    const widget = widgetRegistry.getWidget(draggedCatalogueWidget() ?? '');
    if (!widget || full) return false;
    const size = convertSize(widget.defaultSize, DEFAULT_GRID_CONFIG, gridConfig);
    return { w: Math.min(size.w, gridProps.cols[breakpoint]), h: size.h };
  }, [full, gridConfig, gridProps.cols, breakpoint]);
  const onDrop = useCallback(
    (_layout: Layout[], item: Layout | undefined) => {
      const widget = widgetRegistry.getWidget(draggedCatalogueWidget() ?? '');
      endCatalogueDrag();
      if (!widget || !item) return;
      if (dropWidgetOnPage(page, widget.id, { x: item.x, y: item.y }, breakpoint)) {
        notify({ message: `Added ${widget.name}`, tone: 'success' });
      } else {
        notify({
          message: `This page already has the maximum of ${MAX_WIDGETS_PER_PAGE} widgets. Remove one first.`,
          tone: 'error',
        });
      }
    },
    [page, breakpoint, notify],
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
    <div ref={wrapperRef} className="relative isolate">
      <ResponsiveGridLayout
        className={cx('layout', locked && 'is-locked', settled && 'grid-animate')}
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
        resizeHandles={RESIZE_HANDLES}
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragStop={onDragStop}
        onResizeStop={onResizeStop}
        onLayoutChange={onLayoutChange}
        isDroppable={!locked}
        droppingItem={DROPPING_ITEM}
        onDropDragOver={onDropDragOver}
        onDrop={onDrop}
      >
        {children}
      </ResponsiveGridLayout>
      {departure ? (
        <div
          aria-hidden="true"
          data-testid="drag-departure"
          className="grid-departure"
          style={departure}
        />
      ) : null}
    </div>
  );
}

export const GridContainer = memo(GridContainerImpl);
