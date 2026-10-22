import type {
  Breakpoint,
  BreakpointLayouts,
  GridItemLayout,
  GridPosition,
  PageId,
  PageSnapshot,
  WidgetInstance,
} from '@/types';
import { getWidget } from '@/registry/registry';
import { defaultSnapshot } from '@/registry/pages';
import { env } from '@/utils/env';
import { bottomOf, useDashboardStore } from './dashboardStore';
import { createId } from './storage';
import { useWidgetStore } from './widgetStore';

const BREAKPOINT_KEYS: readonly Breakpoint[] = ['lg', 'md', 'sm', 'xs'];

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

/** Next free desktop position for a widget of size w x h (bottom-left of the page). */
function nextPosition(page: PageId, w: number, h: number): GridPosition {
  const lg = useDashboardStore.getState().pages[page].layouts.lg ?? [];
  return { x: 0, y: bottomOf(lg), w, h };
}

function toPosition(item: GridItemLayout): GridPosition {
  return { x: item.x, y: item.y, w: item.w, h: item.h };
}

/** Add a widget at the bottom of a page. Returns null for unknown types or a full page. */
export function addWidget(page: PageId, widgetId: string): string | null {
  const entry = getWidget(widgetId);
  if (!entry || !canAddWidget(page)) return null;
  const { defaultSize } = entry.definition;
  const position = nextPosition(page, defaultSize.w, defaultSize.h);
  const instanceId = useWidgetStore.getState().createInstance(widgetId, position, {});
  useDashboardStore.getState().addItem(page, { i: instanceId, ...position });
  return instanceId;
}

/** Save grid changes (drag, resize, breakpoint) and mirror the lg placement into instances. */
export function commitLayouts(page: PageId, layouts: BreakpointLayouts): void {
  useDashboardStore.getState().setLayouts(page, layouts);
  const lg = layouts.lg;
  if (!lg) return;
  useWidgetStore
    .getState()
    .setPositions(Object.fromEntries(lg.map((item) => [item.i, toPosition(item)])));
}

export interface RemovedWidget {
  page: PageId;
  instance: WidgetInstance;
  layouts: Partial<Record<Breakpoint, GridItemLayout>>;
}

/** Remove a widget and return what is needed to undo it. */
export function removeWidget(page: PageId, instanceId: string): RemovedWidget | null {
  const instance = useWidgetStore.getState().instances[instanceId];
  if (!instance) return null;
  const grid = useDashboardStore.getState().pages[page];
  const layouts: RemovedWidget['layouts'] = {};
  for (const bp of BREAKPOINT_KEYS) {
    const item = grid.layouts[bp]?.find((l) => l.i === instanceId);
    if (item) layouts[bp] = item;
  }
  useDashboardStore.getState().removeItem(page, instanceId);
  useWidgetStore.getState().removeInstances([instanceId]);
  return { page, instance, layouts };
}

export function restoreWidget(removed: RemovedWidget): void {
  useWidgetStore.getState().upsertInstances([removed.instance]);
  useDashboardStore
    .getState()
    .restoreItem(removed.page, removed.instance.instanceId, removed.layouts);
}

/** Duplicate a widget with its settings. Returns null when the page is full. */
export function duplicateWidget(page: PageId, instanceId: string): string | null {
  if (!canAddWidget(page)) return null;
  const source = useWidgetStore.getState().instances[instanceId];
  if (!source) return null;
  const sourceItem = useDashboardStore
    .getState()
    .pages[page].layouts.lg?.find((l) => l.i === instanceId);
  const size = getWidget(source.widgetId)?.definition.defaultSize;
  const position = nextPosition(page, sourceItem?.w ?? size?.w ?? 4, sourceItem?.h ?? size?.h ?? 8);
  const baseTitle = source.title ?? getWidget(source.widgetId)?.definition.name ?? 'Widget';
  const copyId = useWidgetStore
    .getState()
    .duplicateInstance(instanceId, position, `${baseTitle} (copy)`.slice(0, 80));
  if (!copyId) return null;
  useDashboardStore.getState().addItem(page, { i: copyId, ...position });
  return copyId;
}

/** Capture a page: layout, widget settings and placement. Never includes datasets. */
export function captureSnapshot(page: PageId): PageSnapshot {
  const grid = useDashboardStore.getState().pages[page];
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
 * at their own `position`.
 */
export function applySnapshot(page: PageId, snapshot: PageSnapshot, keepIds = false): ApplyResult {
  const known = snapshot.instances
    .filter((i) => getWidget(i.widgetId))
    .slice(0, MAX_WIDGETS_PER_PAGE);
  const idMap = new Map(
    known.map((i) => [i.instanceId, keepIds ? i.instanceId : createId(i.widgetId)]),
  );
  const layouts: BreakpointLayouts = {};
  for (const bp of BREAKPOINT_KEYS) {
    const layout = snapshot.layouts[bp];
    if (!layout) continue;
    layouts[bp] = layout.flatMap((item) => {
      const next = idMap.get(item.i);
      return next ? [{ ...item, i: next }] : [];
    });
  }
  const lg = layouts.lg ?? [];
  const placed = new Set(lg.map((item) => item.i));
  const instances: WidgetInstance[] = known.map((i) => {
    const instanceId = idMap.get(i.instanceId) ?? i.instanceId;
    const item = lg.find((l) => l.i === instanceId);
    return { ...i, instanceId, position: item ? toPosition(item) : i.position };
  });
  for (const instance of instances) {
    if (!placed.has(instance.instanceId)) lg.push({ i: instance.instanceId, ...instance.position });
  }
  layouts.lg = lg;

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
