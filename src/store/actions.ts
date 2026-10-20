import type { Breakpoint, GridItemLayout, PageId, PageSnapshot, WidgetInstance } from '@/types';
import { getWidget } from '@/registry/registry';
import { defaultSnapshot } from '@/registry/pages';
import { useDashboardStore } from './dashboardStore';
import { createId } from './storage';
import { useWidgetStore } from './widgetStore';

const BREAKPOINT_KEYS: readonly Breakpoint[] = ['lg', 'md', 'sm', 'xs'];

/**
 * Cross-store operations. Each store owns one concern; these helpers keep the grid layout
 * (DashboardStore) and the widget instances (WidgetStore) consistent with each other.
 */

export function addWidget(page: PageId, type: string): string | null {
  const entry = getWidget(type);
  if (!entry) return null;
  const { definition } = entry;
  const id = useWidgetStore.getState().createInstance(type, definition.name, {});
  useDashboardStore.getState().addItem(page, {
    i: id,
    x: 0,
    y: 0,
    w: definition.defaultSize.w,
    h: definition.defaultSize.h,
  });
  return id;
}

export interface RemovedWidget {
  page: PageId;
  instance: WidgetInstance;
  layouts: Partial<Record<Breakpoint, GridItemLayout>>;
}

/** Remove a widget and return what is needed to undo it. */
export function removeWidget(page: PageId, id: string): RemovedWidget | null {
  const instance = useWidgetStore.getState().instances[id];
  if (!instance) return null;
  const grid = useDashboardStore.getState().pages[page];
  const layouts: RemovedWidget['layouts'] = {};
  for (const bp of BREAKPOINT_KEYS) {
    const item = grid.layouts[bp]?.find((l) => l.i === id);
    if (item) layouts[bp] = item;
  }
  useDashboardStore.getState().removeItem(page, id);
  useWidgetStore.getState().removeInstances([id]);
  return { page, instance, layouts };
}

export function restoreWidget(removed: RemovedWidget): void {
  useWidgetStore.getState().upsertInstances([removed.instance]);
  useDashboardStore.getState().restoreItem(removed.page, removed.instance.id, removed.layouts);
}

export function duplicateWidget(page: PageId, id: string): string | null {
  const copyId = useWidgetStore.getState().duplicateInstance(id);
  if (!copyId) return null;
  const grid = useDashboardStore.getState().pages[page];
  const source = grid.layouts.lg?.find((l) => l.i === id);
  const instance = useWidgetStore.getState().instances[copyId];
  const entry = instance ? getWidget(instance.type) : undefined;
  useDashboardStore.getState().addItem(page, {
    i: copyId,
    x: 0,
    y: 0,
    w: source?.w ?? entry?.definition.defaultSize.w ?? 4,
    h: source?.h ?? entry?.definition.defaultSize.h ?? 8,
  });
  return copyId;
}

/** Capture a page: layout, widget settings and nothing else (no datasets). */
export function captureSnapshot(page: PageId): PageSnapshot {
  const grid = useDashboardStore.getState().pages[page];
  const instances = useWidgetStore.getState().instances;
  return {
    page,
    layouts: grid.layouts,
    instances: grid.itemIds.flatMap((id) => {
      const instance = instances[id];
      return instance ? [instance] : [];
    }),
  };
}

/**
 * Replace a page with a snapshot. Instance ids are re-issued so a snapshot can be applied to
 * any page without colliding with widgets elsewhere. Unknown widget types are skipped.
 */
export function applySnapshot(page: PageId, snapshot: PageSnapshot, keepIds = false): void {
  const known = snapshot.instances.filter((i) => getWidget(i.type));
  const idMap = new Map(known.map((i) => [i.id, keepIds ? i.id : createId(i.type)]));
  const instances = known.map((i) => ({ ...i, id: idMap.get(i.id) ?? i.id }));
  const layouts: PageSnapshot['layouts'] = {};
  for (const bp of BREAKPOINT_KEYS) {
    const layout = snapshot.layouts[bp];
    if (!layout) continue;
    layouts[bp] = layout.flatMap((item) => {
      const next = idMap.get(item.i);
      return next ? [{ ...item, i: next }] : [];
    });
  }
  const previous = useDashboardStore.getState().pages[page].itemIds;
  useWidgetStore
    .getState()
    .removeInstances(previous.filter((id) => !instances.some((i) => i.id === id)));
  useWidgetStore.getState().upsertInstances(instances);
  useDashboardStore.getState().replacePage(page, { itemIds: instances.map((i) => i.id), layouts });
}

export function resetPage(page: PageId): void {
  applySnapshot(page, defaultSnapshot(page), true);
}
