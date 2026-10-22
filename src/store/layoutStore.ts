import { z } from 'zod';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Layout, LayoutVersion, PageId, PageSnapshot, ShareRecord } from '@/types';
import { sanitizeText } from '@/utils/sanitize';
import { LayoutSchema, PageIdSchema, ShareRecordSchema } from './schemas';
import { createId, createValidatedStorage, devtoolsEnabled } from './storage';

export const MAX_VERSIONS = 20;
export const MAX_SAVED_LAYOUTS = 30;
export const MAX_SHARES = 10;

interface LayoutData {
  /** Saved page layouts; each keeps its version history (oldest first) in `versions`. */
  savedLayouts: Layout[];
  /** Saved layout currently loaded on each page, if any. */
  activeByPage: Partial<Record<PageId, string>>;
  /** Share links the user has copied, newest first. */
  shares: ShareRecord[];
}

interface LayoutActions {
  /** Save a page as a new layout (version 1) and mark it active on that page. */
  saveLayout: (name: string, snapshot: PageSnapshot, nowIso: string) => string;
  /** Add a version to a saved layout. Returns the new version number, or null if not found. */
  saveVersion: (id: string, snapshot: PageSnapshot, note: string, nowIso: string) => number | null;
  renameLayout: (id: string, name: string) => void;
  deleteLayout: (id: string) => void;
  setActive: (page: PageId, id: string | null) => void;
  /** Remember a share link. Returns its id. Only the newest MAX_SHARES are kept. */
  recordShare: (share: Omit<ShareRecord, 'id'>) => string;
  removeShare: (id: string) => void;
  clearShares: () => void;
}

export type LayoutState = LayoutData & LayoutActions;

const PersistedSchema = z.preprocess(
  (raw) => {
    // Version 1 called the list `saved`.
    if (typeof raw !== 'object' || raw === null || 'savedLayouts' in raw) return raw;
    return 'saved' in raw ? { ...raw, savedLayouts: raw.saved } : raw;
  },
  z.object({
    savedLayouts: z.array(LayoutSchema).max(MAX_SAVED_LAYOUTS),
    activeByPage: z.record(PageIdSchema, z.string()),
    shares: z.array(ShareRecordSchema).max(MAX_SHARES).default([]),
  }),
);
type Persisted = z.infer<typeof PersistedSchema>;

function cleanName(name: string): string {
  return sanitizeText(name, 60) || 'Untitled layout';
}

/** Versions of a saved layout, oldest first (empty when the id is unknown). */
export function selectVersions(state: LayoutData, id: string): LayoutVersion[] {
  return state.savedLayouts.find((l) => l.id === id)?.versions ?? [];
}

export const useLayoutStore = create<LayoutState>()(
  devtools(
    persist(
      immer((set, get) => ({
        savedLayouts: [],
        activeByPage: {},
        shares: [],

        saveLayout: (name, snapshot, nowIso) => {
          const id = createId('layout');
          set((s) => {
            if (s.savedLayouts.length >= MAX_SAVED_LAYOUTS) s.savedLayouts.shift();
            s.savedLayouts.push({
              id,
              name: cleanName(name),
              page: snapshot.page,
              createdAt: nowIso,
              updatedAt: nowIso,
              versions: [{ version: 1, createdAt: nowIso, note: 'Initial save', snapshot }],
            });
            s.activeByPage[snapshot.page] = id;
          });
          return id;
        },

        saveVersion: (id, snapshot, note, nowIso) => {
          const layout = get().savedLayouts.find((l) => l.id === id);
          if (!layout) return null;
          const version = (layout.versions[layout.versions.length - 1]?.version ?? 0) + 1;
          set((s) => {
            const target = s.savedLayouts.find((l) => l.id === id);
            if (!target) return;
            target.versions.push({
              version,
              createdAt: nowIso,
              note: sanitizeText(note, 120) || `Version ${version}`,
              snapshot,
            });
            if (target.versions.length > MAX_VERSIONS) target.versions.shift();
            target.updatedAt = nowIso;
          });
          return version;
        },

        renameLayout: (id, name) =>
          set((s) => {
            const target = s.savedLayouts.find((l) => l.id === id);
            if (target) target.name = cleanName(name);
          }),

        deleteLayout: (id) =>
          set((s) => {
            s.savedLayouts = s.savedLayouts.filter((l) => l.id !== id);
            for (const [page, active] of Object.entries(s.activeByPage)) {
              const parsed = PageIdSchema.safeParse(page);
              if (active === id && parsed.success) delete s.activeByPage[parsed.data];
            }
          }),

        setActive: (page, id) =>
          set((s) => {
            if (id === null) delete s.activeByPage[page];
            else s.activeByPage[page] = id;
          }),

        recordShare: (share) => {
          const id = createId('share');
          set((s) => {
            s.shares.unshift({ ...share, id });
            s.shares.splice(MAX_SHARES);
          });
          return id;
        },

        removeShare: (id) =>
          set((s) => {
            s.shares = s.shares.filter((share) => share.id !== id);
          }),

        clearShares: () =>
          set((s) => {
            s.shares = [];
          }),
      })),
      {
        name: 'meridian:layouts',
        version: 2,
        storage: createValidatedStorage<Persisted>(PersistedSchema),
        partialize: (s): Persisted => ({
          savedLayouts: s.savedLayouts,
          activeByPage: s.activeByPage,
          shares: s.shares,
        }),
        // Version 1 differs only in naming, which the schema upgrades on load. Saved snapshots
        // without `grid` are converted from the old grid when they are applied.
        migrate: (persisted): Persisted => {
          const parsed = PersistedSchema.safeParse(persisted);
          return parsed.success ? parsed.data : { savedLayouts: [], activeByPage: {}, shares: [] };
        },
      },
    ),
    { name: 'LayoutStore', enabled: devtoolsEnabled },
  ),
);
