import { z } from 'zod';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  Breakpoint,
  BreakpointLayouts,
  GridConfig,
  GridItemLayout,
  GridSize,
  PageId,
} from '@/types';
import { defaultSnapshot } from '@/registry/pages';
import {
  BREAKPOINT_KEYS,
  bottomOf,
  columnsFor,
  convertLayouts,
  DEFAULT_GRID_CONFIG,
  LEGACY_GRID_CONFIG,
  resolveLayout,
} from '@/utils/gridLayout';
import { BreakpointLayoutsSchema, GridConfigSchema, PAGE_IDS, PageIdSchema } from './schemas';
import { createValidatedStorage, devtoolsEnabled } from './storage';

export interface PageGrid {
  /** Widget instance ids placed on this page, in insertion order. */
  itemIds: string[];
  /** Placement per breakpoint, in `gridConfig` units. */
  layouts: BreakpointLayouts;
}

export type DisplayCurrency = 'INR' | 'USD';

interface DashboardData {
  gridConfig: GridConfig;
  pages: Record<PageId, PageGrid>;
  locked: boolean;
  displayCurrency: DisplayCurrency;
  /** Alert ids the user has acknowledged (alert ids are stable per rule and entity). */
  acknowledgedAlertIds: string[];
}

interface DashboardActions {
  /**
   * Change grid settings. The merged settings must be within GRID_LIMITS; otherwise nothing
   * changes and this returns false. Every page's layouts are converted to the new grid so
   * widgets keep their relative width and roughly their pixel height.
   */
  setGridConfig: (patch: Partial<GridConfig>) => boolean;
  resetGridConfig: () => void;
  /** Replace a page's layouts (from react-grid-layout after a drag, resize or breakpoint). */
  setLayouts: (page: PageId, layouts: BreakpointLayouts) => void;
  /**
   * Place a widget instance on a page. On the desktop (lg) layout it goes to the item's x/y
   * and overlapping widgets move down; on other breakpoints already laid out it goes to the
   * bottom. Ignored when the instance is already on the page.
   */
  addWidget: (page: PageId, item: GridItemLayout) => void;
  removeWidget: (page: PageId, instanceId: string) => void;
  /** Put a removed widget back at its previous positions (undo). */
  restoreWidget: (
    page: PageId,
    instanceId: string,
    items: Partial<Record<Breakpoint, GridItemLayout>>,
  ) => void;
  /** Move a widget to cell x/y (default: desktop layout); overlapping widgets move down. */
  moveWidget: (
    page: PageId,
    instanceId: string,
    to: { x: number; y: number },
    breakpoint?: Breakpoint,
  ) => void;
  /**
   * Resize a widget (default: desktop layout), kept inside the grid's columns; overlapping
   * widgets move down. Per-widget min and max sizes are enforced by the grid UI.
   */
  resizeWidget: (page: PageId, instanceId: string, size: GridSize, breakpoint?: Breakpoint) => void;
  replacePage: (page: PageId, grid: PageGrid) => void;
  setLocked: (locked: boolean) => void;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  acknowledgeAlerts: (ids: string[]) => void;
}

export type DashboardState = DashboardData & DashboardActions;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A page's factory layout, converted to `grid` (default pages are written for the default). */
function defaultGrid(page: PageId, grid: GridConfig = DEFAULT_GRID_CONFIG): PageGrid {
  const snapshot = defaultSnapshot(page);
  return {
    itemIds: snapshot.instances.map((i) => i.instanceId),
    layouts: convertLayouts(snapshot.layouts, snapshot.grid ?? DEFAULT_GRID_CONFIG, grid),
  };
}

function defaultPages(grid: GridConfig = DEFAULT_GRID_CONFIG): Record<PageId, PageGrid> {
  return {
    workstation: defaultGrid('workstation', grid),
    risk: defaultGrid('risk', grid),
    holdings: defaultGrid('holdings', grid),
    performance: defaultGrid('performance', grid),
    research: defaultGrid('research', grid),
  };
}

const PageGridSchema = z.object({ itemIds: z.array(z.string()), layouts: BreakpointLayoutsSchema });

const PersistedSchema = z.preprocess(
  (raw) => {
    // Version 1 stored acknowledged alerts as readAlertIds.
    if (typeof raw !== 'object' || raw === null || 'acknowledgedAlertIds' in raw) return raw;
    return 'readAlertIds' in raw ? { ...raw, acknowledgedAlertIds: raw.readAlertIds } : raw;
  },
  z.object({
    /** Absent before version 2. */
    gridConfig: GridConfigSchema.optional(),
    /** Missing pages are filled with defaults on load, so new app areas appear. */
    pages: z.record(PageIdSchema, PageGridSchema),
    locked: z.boolean(),
    displayCurrency: z.enum(['INR', 'USD']),
    acknowledgedAlertIds: z.array(z.string().max(80)).max(500).default([]),
  }),
);

type Persisted = z.infer<typeof PersistedSchema>;

/**
 * Persisted state from an older version. Version 1 laid pages out on 28 px rows; convert
 * them to the default 60 px grid so widgets keep their size.
 */
export function migrateDashboardState(persisted: unknown, version: number): Persisted | null {
  const parsed = PersistedSchema.safeParse(persisted);
  if (!parsed.success) return null;
  const state = parsed.data;
  if (version >= 2) return state;
  const grid = state.gridConfig ?? { ...DEFAULT_GRID_CONFIG };
  const pages: Persisted['pages'] = {};
  for (const id of PAGE_IDS) {
    const page = state.pages[id];
    if (page) {
      pages[id] = { ...page, layouts: convertLayouts(page.layouts, LEGACY_GRID_CONFIG, grid) };
    }
  }
  return { ...state, gridConfig: grid, pages };
}

export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      immer((set, get) => ({
        gridConfig: { ...DEFAULT_GRID_CONFIG },
        pages: defaultPages(),
        locked: false,
        displayCurrency: 'INR',
        acknowledgedAlertIds: [],

        setGridConfig: (patch) => {
          const current = get().gridConfig;
          const parsed = GridConfigSchema.safeParse({ ...current, ...patch });
          if (!parsed.success) return false;
          const next = parsed.data;
          set((s) => {
            for (const id of PAGE_IDS) {
              s.pages[id].layouts = convertLayouts(s.pages[id].layouts, current, next);
            }
            s.gridConfig = next;
          });
          return true;
        },

        resetGridConfig: () => {
          get().setGridConfig(DEFAULT_GRID_CONFIG);
        },

        setLayouts: (page, layouts) =>
          set((s) => {
            s.pages[page].layouts = layouts;
          }),

        addWidget: (page, item) =>
          set((s) => {
            const grid = s.pages[page];
            if (grid.itemIds.includes(item.i)) return;
            grid.itemIds.push(item.i);
            const cols = columnsFor(s.gridConfig);
            for (const bp of BREAKPOINT_KEYS) {
              const layout = grid.layouts[bp];
              if (!layout && bp !== 'lg') continue;
              const target = layout ?? [];
              const w = clamp(Math.round(item.w), 1, cols[bp]);
              const h = Math.max(1, Math.round(item.h));
              const placed: GridItemLayout =
                bp === 'lg'
                  ? {
                      i: item.i,
                      x: clamp(Math.round(item.x), 0, cols[bp] - w),
                      y: Math.max(0, Math.round(item.y)),
                      w,
                      h,
                    }
                  : { i: item.i, x: 0, y: bottomOf(target), w, h };
              grid.layouts[bp] = resolveLayout(
                [...target, placed],
                s.gridConfig.compaction,
                item.i,
              );
            }
          }),

        removeWidget: (page, instanceId) =>
          set((s) => {
            const grid = s.pages[page];
            grid.itemIds = grid.itemIds.filter((x) => x !== instanceId);
            for (const bp of BREAKPOINT_KEYS) {
              const layout = grid.layouts[bp];
              if (!layout) continue;
              grid.layouts[bp] = resolveLayout(
                layout.filter((l) => l.i !== instanceId),
                s.gridConfig.compaction,
              );
            }
          }),

        restoreWidget: (page, instanceId, items) =>
          set((s) => {
            const grid = s.pages[page];
            if (!grid.itemIds.includes(instanceId)) grid.itemIds.push(instanceId);
            for (const bp of BREAKPOINT_KEYS) {
              const item = items[bp];
              if (!item) continue;
              const layout = (grid.layouts[bp] ?? []).filter((l) => l.i !== instanceId);
              grid.layouts[bp] = resolveLayout(
                [...layout, { ...item, i: instanceId }],
                s.gridConfig.compaction,
                instanceId,
              );
            }
          }),

        moveWidget: (page, instanceId, to, breakpoint = 'lg') =>
          set((s) => {
            const layout = s.pages[page].layouts[breakpoint];
            const item = layout?.find((l) => l.i === instanceId);
            if (!layout || !item) return;
            const cols = columnsFor(s.gridConfig)[breakpoint];
            const moved: GridItemLayout = {
              ...item,
              x: clamp(Math.round(to.x), 0, Math.max(0, cols - item.w)),
              y: Math.max(0, Math.round(to.y)),
            };
            s.pages[page].layouts[breakpoint] = resolveLayout(
              layout.map((l) => (l.i === instanceId ? moved : l)),
              s.gridConfig.compaction,
              instanceId,
            );
          }),

        resizeWidget: (page, instanceId, size, breakpoint = 'lg') =>
          set((s) => {
            const layout = s.pages[page].layouts[breakpoint];
            const item = layout?.find((l) => l.i === instanceId);
            if (!layout || !item) return;
            const cols = columnsFor(s.gridConfig)[breakpoint];
            const resized: GridItemLayout = {
              ...item,
              w: clamp(Math.round(size.w), 1, cols - item.x),
              h: Math.max(1, Math.round(size.h)),
            };
            s.pages[page].layouts[breakpoint] = resolveLayout(
              layout.map((l) => (l.i === instanceId ? resized : l)),
              s.gridConfig.compaction,
              instanceId,
            );
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

        acknowledgeAlerts: (ids) =>
          set((s) => {
            s.acknowledgedAlertIds = Array.from(new Set([...s.acknowledgedAlertIds, ...ids])).slice(
              -500,
            );
          }),
      })),
      {
        name: 'meridian:dashboard',
        version: 2,
        storage: createValidatedStorage<Persisted>(PersistedSchema),
        partialize: (s): Persisted => ({
          gridConfig: s.gridConfig,
          pages: s.pages,
          locked: s.locked,
          displayCurrency: s.displayCurrency,
          acknowledgedAlertIds: s.acknowledgedAlertIds,
        }),
        migrate: (persisted, version): Persisted =>
          // Unreadable old state: start from the defaults.
          migrateDashboardState(persisted, version) ?? {
            gridConfig: { ...DEFAULT_GRID_CONFIG },
            pages: defaultPages(),
            locked: false,
            displayCurrency: 'INR',
            acknowledgedAlertIds: [],
          },
        merge: (persisted, current) => {
          const parsed = PersistedSchema.safeParse(persisted);
          if (!parsed.success) return current;
          const { gridConfig = current.gridConfig, pages, ...rest } = parsed.data;
          const filled = defaultPages(gridConfig);
          for (const id of PAGE_IDS) {
            const page = pages[id];
            if (page) filled[id] = page;
          }
          return { ...current, ...rest, gridConfig, pages: filled };
        },
      },
    ),
    { name: 'DashboardStore', enabled: devtoolsEnabled },
  ),
);
