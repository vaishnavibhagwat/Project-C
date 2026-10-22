import type {
  Breakpoint,
  BreakpointLayouts,
  GridConfig,
  GridItemLayout,
  GridPosition,
  PageId,
  PageSnapshot,
  WidgetInstance,
} from '@/types';
import { widgetRegistry } from '@/registry/registry';
import { defaultSnapshot } from '@/registry/pages';
import { env } from '@/utils/env';
import {
  BREAKPOINT_KEYS,
  bottomOf,
  convertLayouts,
  convertPosition,
  convertSize,
  DEFAULT_GRID_CONFIG,
  LEGACY_GRID_CONFIG,
} from '@/utils/gridLayout';
import { useDashboardStore } from './dashboardStore';
import { PAGE_IDS } from './schemas';
import { createId } from './storage';
import { useWidgetStore } from './widgetStore';

/**
 * Cross-store operations. Each store owns one concern; these helpers keep the grid layout
 * (DashboardStore) and the widget instances (WidgetStore) consistent with each other.
 * DashboardStore's lg layout is the source of truth for placement; each instance's `position`
 * mirrors it so a WidgetInstance is self-describing when exported or shared.
 */

/** Widgets allowed on one page (VITE_MAX_WIDGETS). */
export const MAX_WIDGETS_PER_PAGE = env.VITE_MAX_WIDGETS;

export function widgetCount(page: PageId): number {
  return useDashboardStore.getState().pages[page].itemIds.length;
}

export function canAddWidget(page: PageId): boolean {
  return widgetCount(page) < MAX_WIDGETS_PER_PAGE;
}

function currentGrid(): GridConfig {
  return useDashboardStore.getState().gridConfig;
}

/** Next free desktop position for a widget of size w x h (bottom-left of the page). */
function nextPosition(page: PageId, w: number, h: number): GridPosition {
  const lg = useDashboardStore.getState().pages[page].layouts.lg ?? [];
  return { x: 0, y: bottomOf(lg), w, h };
}

function toPosition(item: GridItemLayout): GridPosition {
  return { x: item.x, y: item.y, w: item.w, h: item.h };
}

/** Copy a page's desktop placement into its instances' `position`. */
function syncPositions(page: PageId): void {
  const lg = useDashboardStore.getState().pages[page].layouts.lg;
  if (!lg) return;
  useWidgetStore
    .getState()
    .setPositions(Object.fromEntries(lg.map((item) => [item.i, toPosition(item)])));
}

/** Add a widget at the bottom of a page. Returns null for unknown types or a full page. */
export function addWidgetToPage(page: PageId, widgetId: string): string | null {
  const widget = widgetRegistry.getWidget(widgetId);
  if (!widget || !canAddWidget(page)) return null;
  // Widget sizes are written for the default grid.
  const size = convertSize(widget.defaultSize, DEFAULT_GRID_CONFIG, currentGrid());
  const position = nextPosition(page, size.w, size.h);
  const instanceId = useWidgetStore.getState().createInstance(widgetId, position, {});
  useDashboardStore.getState().addWidget(page, { i: instanceId, ...position });
  syncPositions(page);
  return instanceId;
}

/** Save grid changes (drag, resize, breakpoint) and mirror the lg placement into instances. */
export function commitLayouts(page: PageId, layouts: BreakpointLayouts): void {
  useDashboardStore.getState().setLayouts(page, layouts);
  syncPositions(page);
}

/** Change grid settings and keep instance positions in step. See DashboardStore.setGridConfig. */
export function applyGridConfig(patch: Partial<GridConfig>): boolean {
  const ok = useDashboardStore.getState().setGridConfig(patch);
  if (ok) for (const page of PAGE_IDS) syncPositions(page);
  return ok;
}

export interface RemovedWidget {
  page: PageId;
  instance: WidgetInstance;
  layouts: Partial<Record<Breakpoint, GridItemLayout>>;
}

/** Remove a widget and return what is needed to undo it. */
export function removeWidgetFromPage(page: PageId, instanceId: string): RemovedWidget | null {
  const instance = useWidgetStore.getState().instances[instanceId];
  if (!instance) return null;
  const grid = useDashboardStore.getState().pages[page];
  const layouts: RemovedWidget['layouts'] = {};
  for (const bp of BREAKPOINT_KEYS) {
    const item = grid.layouts[bp]?.find((l) => l.i === instanceId);
    if (item) layouts[bp] = item;
  }
  useDashboardStore.getState().removeWidget(page, instanceId);
  useWidgetStore.getState().removeInstances([instanceId]);
  syncPositions(page);
  return { page, instance, layouts };
}

/** Undo removeWidgetFromPage. */
export function restoreRemovedWidget(removed: RemovedWidget): void {
  useWidgetStore.getState().upsertInstances([removed.instance]);
  useDashboardStore
    .getState()
    .restoreWidget(removed.page, removed.instance.instanceId, removed.layouts);
  syncPositions(removed.page);
}

/** Duplicate a widget with its settings. Returns null when the page is full. */
export function duplicateWidget(page: PageId, instanceId: string): string | null {
  if (!canAddWidget(page)) return null;
  const source = useWidgetStore.getState().instances[instanceId];
  if (!source) return null;
  const sourceItem = useDashboardStore
    .getState()
    .pages[page].layouts.lg?.find((l) => l.i === instanceId);
  const widget = widgetRegistry.getWidget(source.widgetId);
  const size =
    sourceItem ??
    convertSize(widget?.defaultSize ?? { w: 4, h: 4 }, DEFAULT_GRID_CONFIG, currentGrid());
  const position = nextPosition(page, size.w, size.h);
  const baseTitle = source.title ?? widget?.name ?? 'Widget';
  const copyId = useWidgetStore
    .getState()
    .duplicateInstance(instanceId, position, `${baseTitle} (copy)`.slice(0, 80));
  if (!copyId) return null;
  useDashboardStore.getState().addWidget(page, { i: copyId, ...position });
  syncPositions(page);
  return copyId;
}

/** Capture a page: layout, widget settings, placement and grid settings. Never datasets. */
export function captureSnapshot(page: PageId): PageSnapshot {
  const { pages, gridConfig } = useDashboardStore.getState();
  const grid = pages[page];
  const instances = useWidgetStore.getState().instances;
  const lg = new Map((grid.layouts.lg ?? []).map((item) => [item.i, item]));
  return {
    page,
    layouts: grid.layouts,
    instances: grid.itemIds.flatMap((id) => {
      const instance = instances[id];
      if (!instance) return [];
      const item = lg.get(id);
      return [item ? { ...instance, position: toPosition(item) } : instance];
    }),
    grid: { ...gridConfig },
  };
}

export interface ApplyResult {
  applied: number;
  /** Widgets left out: unknown types, or beyond the per-page limit. */
  dropped: number;
}

/**
 * Replace a page with a snapshot. Instance ids are re-issued so a snapshot can be applied to
 * any page without colliding with widgets elsewhere. Unknown widget types are skipped and at
 * most MAX_WIDGETS_PER_PAGE widgets are kept. Instances missing from the lg layout are placed
 * at their own `position`. Layouts are converted from the snapshot's grid (the old 28 px grid
 * when it has none) to the current grid.
 */
export function applySnapshot(page: PageId, snapshot: PageSnapshot, keepIds = false): ApplyResult {
  const from = snapshot.grid ?? LEGACY_GRID_CONFIG;
  const to = currentGrid();
  const known = snapshot.instances
    .filter((i) => widgetRegistry.hasWidget(i.widgetId))
    .slice(0, MAX_WIDGETS_PER_PAGE);
  const idMap = new Map(
    known.map((i) => [i.instanceId, keepIds ? i.instanceId : createId(i.widgetId)]),
  );
  const renamed: BreakpointLayouts = {};
  for (const bp of BREAKPOINT_KEYS) {
    const layout = snapshot.layouts[bp];
    if (!layout) continue;
    renamed[bp] = layout.flatMap((item) => {
      const next = idMap.get(item.i);
      return next ? [{ ...item, i: next }] : [];
    });
  }
  // Instances without a desktop placement go to their own position.
  const lg = renamed.lg ?? [];
  const placed = new Set(lg.map((item) => item.i));
  for (const instance of known) {
    const instanceId = idMap.get(instance.instanceId) ?? instance.instanceId;
    if (!placed.has(instanceId)) lg.push({ i: instanceId, ...instance.position });
  }
  renamed.lg = lg;
  const layouts = convertLayouts(renamed, from, to);

  const placedLg = new Map((layouts.lg ?? []).map((item) => [item.i, item]));
  const instances: WidgetInstance[] = known.map((i) => {
    const instanceId = idMap.get(i.instanceId) ?? i.instanceId;
    const item = placedLg.get(instanceId);
    return {
      ...i,
      instanceId,
      position: item ? toPosition(item) : convertPosition(i.position, from, to),
    };
  });

  const previous = useDashboardStore.getState().pages[page].itemIds;
  const keep = new Set(instances.map((i) => i.instanceId));
  useWidgetStore.getState().removeInstances(previous.filter((id) => !keep.has(id)));
  useWidgetStore.getState().upsertInstances(instances);
  useDashboardStore
    .getState()
    .replacePage(page, { itemIds: instances.map((i) => i.instanceId), layouts });
  return { applied: instances.length, dropped: snapshot.instances.length - instances.length };
}

export function resetPage(page: PageId): void {
  void applySnapshot(page, defaultSnapshot(page), true);
}
