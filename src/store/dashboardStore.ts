import { z } from 'zod';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Breakpoint, BreakpointLayouts, GridItemLayout, PageId } from '@/types';
import { defaultSnapshot } from '@/registry/pages';
import { BreakpointLayoutsSchema, PAGE_IDS, PageIdSchema } from './schemas';
import { createValidatedStorage, devtoolsEnabled } from './storage';

/** Column counts per breakpoint. Shared with the grid component. */
export const GRID_COLS: Record<Breakpoint, number> = { lg: 12, md: 10, sm: 6, xs: 2 };
export const GRID_BREAKPOINTS: Record<Breakpoint, number> = { lg: 1200, md: 960, sm: 640, xs: 0 };

export interface PageGrid {
  /** Widget instance ids placed on this page, in insertion order. */
  itemIds: string[];
  layouts: BreakpointLayouts;
}

export type DisplayCurrency = 'INR' | 'USD';

interface DashboardData {
  pages: Record<PageId, PageGrid>;
  locked: boolean;
  displayCurrency: DisplayCurrency;
  /** Alert ids the user has marked as read (alert ids are stable per rule). */
  readAlertIds: string[];
}

interface DashboardActions {
  setLayouts: (page: PageId, layouts: BreakpointLayouts) => void;
  addItem: (page: PageId, item: GridItemLayout) => void;
  removeItem: (page: PageId, id: string) => void;
  /** Put an item back at its previous positions (undo remove). */
  restoreItem: (
    page: PageId,
    id: string,
    items: Partial<Record<Breakpoint, GridItemLayout>>,
  ) => void;
  replacePage: (page: PageId, grid: PageGrid) => void;
  setLocked: (locked: boolean) => void;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  markNotificationsRead: (ids: string[]) => void;
}

export type DashboardState = DashboardData & DashboardActions;

function defaultGrid(page: PageId): PageGrid {
  const snapshot = defaultSnapshot(page);
  return { itemIds: snapshot.instances.map((i) => i.id), layouts: snapshot.layouts };
}

function defaultPages(): Record<PageId, PageGrid> {
  return {
    workstation: defaultGrid('workstation'),
    risk: defaultGrid('risk'),
    holdings: defaultGrid('holdings'),
    performance: defaultGrid('performance'),
    research: defaultGrid('research'),
  };
}

const BREAKPOINTS: Breakpoint[] = ['lg', 'md', 'sm', 'xs'];

/** Lowest free row in a layout, so new widgets land at the bottom. */
export function bottomOf(layout: readonly GridItemLayout[]): number {
  return layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
}

const PageGridSchema = z.object({ itemIds: z.array(z.string()), layouts: BreakpointLayoutsSchema });

const PersistedSchema = z.object({
  pages: z.record(PageIdSchema, PageGridSchema).transform((pages) => {
    // Missing pages fall back to defaults so new app areas appear after upgrades.
    const out = defaultPages();
    for (const id of PAGE_IDS) {
      const grid = pages[id];
      if (grid) out[id] = grid;
    }
    return out;
  }),
  locked: z.boolean(),
  displayCurrency: z.enum(['INR', 'USD']),
  readAlertIds: z.array(z.string().max(80)).max(500),
});

type Persisted = z.infer<typeof PersistedSchema>;

export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      immer((set) => ({
        pages: defaultPages(),
        locked: false,
        displayCurrency: 'INR',
        readAlertIds: [],

        setLayouts: (page, layouts) =>
          set((s) => {
            s.pages[page].layouts = layouts;
          }),

        addItem: (page, item) =>
          set((s) => {
            const grid = s.pages[page];
            if (grid.itemIds.includes(item.i)) return;
            grid.itemIds.push(item.i);
            for (const bp of BREAKPOINTS) {
              const layout = grid.layouts[bp];
              if (!layout && bp !== 'lg') continue;
              const target = layout ?? [];
              const cols = GRID_COLS[bp];
              target.push({ ...item, x: 0, y: bottomOf(target), w: Math.min(item.w, cols) });
              grid.layouts[bp] = target;
            }
          }),

        removeItem: (page, id) =>
          set((s) => {
            const grid = s.pages[page];
            grid.itemIds = grid.itemIds.filter((x) => x !== id);
            for (const bp of BREAKPOINTS) {
              const layout = grid.layouts[bp];
              if (layout) grid.layouts[bp] = layout.filter((l) => l.i !== id);
            }
          }),

        restoreItem: (page, id, items) =>
          set((s) => {
            const grid = s.pages[page];
            if (!grid.itemIds.includes(id)) grid.itemIds.push(id);
            for (const bp of BREAKPOINTS) {
              const item = items[bp];
              const layout = grid.layouts[bp];
              if (item && layout && !layout.some((l) => l.i === id)) layout.push(item);
              else if (item && !layout) grid.layouts[bp] = [item];
            }
          }),

        replacePage: (page, grid) =>
          set((s) => {
            s.pages[page] = grid;
          }),

        setLocked: (locked) =>
          set((s) => {
            s.locked = locked;
          }),

        setDisplayCurrency: (currency) =>
          set((s) => {
            s.displayCurrency = currency;
          }),

        markNotificationsRead: (ids) =>
          set((s) => {
            s.readAlertIds = Array.from(new Set([...s.readAlertIds, ...ids])).slice(-500);
          }),
      })),
      {
        name: 'meridian:dashboard',
        version: 1,
        storage: createValidatedStorage<Persisted>(PersistedSchema),
        partialize: (s): Persisted => ({
          pages: s.pages,
          locked: s.locked,
          displayCurrency: s.displayCurrency,
          readAlertIds: s.readAlertIds,
        }),
      },
    ),
    { name: 'DashboardStore', enabled: devtoolsEnabled },
  ),
);

export function defaultPageGrid(page: PageId): PageGrid {
  return defaultGrid(page);
}
