import { z } from 'zod';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Layout, LayoutVersion, PageId, PageSnapshot, ShareRecord } from '@/types';
import { sanitizeText } from '@/utils/sanitize';
import { LayoutSchema, PageIdSchema, ShareRecordSchema } from './schemas';
import { MAX_LAYOUT_BYTES } from './share';
import { createDebouncedStorage, createId, devtoolsEnabled } from './storage';

/** Versions kept per saved layout; the oldest is dropped when an 11th is saved. */
export const MAX_VERSIONS = 10;
export const MAX_SAVED_LAYOUTS = 30;
export const MAX_SHARES = 10;

interface LayoutData {
  /** Saved page layouts; each keeps its version history (oldest first) in `versions`. */
  savedLayouts: Layout[];
  /** Saved layout currently loaded on each page, if any. */
  activeByPage: Partial<Record<PageId, string>>;
  /** Share links the user has copied, newest first. */
  shares: ShareRecord[];
  /**
   * Per page, the last layout JSON that was exported, imported or saved and passed validation.
   * Offered as "Load last valid layout" when an import fails. Validated again before use.
   */
  lastValidByPage: Partial<Record<PageId, string>>;
}

interface LayoutActions {
  /**
   * Save a page as a new layout (version 1, a new UUID) and mark it active on that page. Also
   * "Save as new": the current page becomes a separate layout.
   */
  saveLayout: (
    name: string,
    snapshot: PageSnapshot,
    nowIso: string,
    description?: string,
  ) => string;
  /** Change a saved layout's name and description. */
  updateDetails: (id: string, name: string, description: string, nowIso: string) => void;
  /** Copy a saved layout, versions included, under a new UUID. Returns the new id. */
  duplicateLayout: (id: string, nowIso: string) => string | null;
  /**
   * Make an earlier version current again: it is saved as a new version ("Reverted to v3"),
   * so nothing in the history is lost. Returns the new version number.
   */
  revertToVersion: (id: string, version: number, nowIso: string) => number | null;
  /** Add a version to a saved layout. Returns the new version number, or null if not found. */
  saveVersion: (id: string, snapshot: PageSnapshot, note: string, nowIso: string) => number | null;
  renameLayout: (id: string, name: string) => void;
  deleteLayout: (id: string) => void;
  setActive: (page: PageId, id: string | null) => void;
  /** Remember a share link. Returns its id. Only the newest MAX_SHARES are kept. */
  recordShare: (share: Omit<ShareRecord, 'id'>) => string;
  removeShare: (id: string) => void;
  clearShares: () => void;
  /** Remember a page's last valid layout JSON (at most MAX_LAYOUT_BYTES). */
  setLastValid: (page: PageId, json: string) => void;
}

export type LayoutState = LayoutData & LayoutActions;

const PersistedSchema = z.preprocess(
  (raw) => {
    // Version 1 called the list `saved`.
    if (typeof raw !== 'object' || raw === null || 'savedLayouts' in raw) return raw;
    return 'saved' in raw ? { ...raw, savedLayouts: raw.saved } : raw;
  },
  z.object({
    // Older data kept up to 20 versions per layout: keep the newest MAX_VERSIONS.
    savedLayouts: z
      .array(LayoutSchema)
      .max(MAX_SAVED_LAYOUTS)
      .transform((layouts) =>
        layouts.map((l) => ({ ...l, versions: l.versions.slice(-MAX_VERSIONS) })),
      ),
    activeByPage: z.record(PageIdSchema, z.string()),
    shares: z.array(ShareRecordSchema).max(MAX_SHARES).default([]),
    lastValidByPage: z.record(PageIdSchema, z.string().max(MAX_LAYOUT_BYTES)).default({}),
  }),
);
type Persisted = z.infer<typeof PersistedSchema>;

function cleanName(name: string): string {
  return sanitizeText(name, 60) || 'Untitled layout';
}

function cleanDescription(description: string): string {
  return sanitizeText(description, 500);
}

/** Append a version and drop the oldest beyond MAX_VERSIONS. */
function pushVersion(layout: Layout, version: LayoutVersion): void {
  layout.versions.push(version);
  if (layout.versions.length > MAX_VERSIONS)
    layout.versions.splice(0, layout.versions.length - MAX_VERSIONS);
  layout.updatedAt = version.createdAt;
}

function nextVersion(layout: Layout): number {
  return (layout.versions[layout.versions.length - 1]?.version ?? 0) + 1;
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
        lastValidByPage: {},

        saveLayout: (name, snapshot, nowIso, description = '') => {
          const id = createId('layout');
          set((s) => {
            if (s.savedLayouts.length >= MAX_SAVED_LAYOUTS) s.savedLayouts.shift();
            s.savedLayouts.push({
              id,
              name: cleanName(name),
              description: cleanDescription(description),
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
          const version = nextVersion(layout);
          set((s) => {
            const target = s.savedLayouts.find((l) => l.id === id);
            if (!target) return;
            pushVersion(target, {
              version,
              createdAt: nowIso,
              note: sanitizeText(note, 120) || `Version ${version}`,
              snapshot,
            });
          });
          return version;
        },

        updateDetails: (id, name, description, nowIso) =>
          set((s) => {
            const target = s.savedLayouts.find((l) => l.id === id);
            if (!target) return;
            target.name = cleanName(name);
            target.description = cleanDescription(description);
            target.updatedAt = nowIso;
          }),

        duplicateLayout: (id, nowIso) => {
          const source = get().savedLayouts.find((l) => l.id === id);
          if (!source) return null;
          const copyId = createId('layout');
          set((s) => {
            if (s.savedLayouts.length >= MAX_SAVED_LAYOUTS) s.savedLayouts.shift();
            s.savedLayouts.push({
              ...structuredClone(source),
              id: copyId,
              name: cleanName(`${source.name} (copy)`),
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          });
          return copyId;
        },

        revertToVersion: (id, version, nowIso) => {
          const layout = get().savedLayouts.find((l) => l.id === id);
          const from = layout?.versions.find((v) => v.version === version);
          if (!layout || !from) return null;
          const next = nextVersion(layout);
          set((s) => {
            const target = s.savedLayouts.find((l) => l.id === id);
            if (!target) return;
            pushVersion(target, {
              version: next,
              createdAt: nowIso,
              note: `Reverted to v${version}`,
              snapshot: structuredClone(from.snapshot),
            });
          });
          return next;
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

        setLastValid: (page, json) =>
          set((s) => {
            if (json.length <= MAX_LAYOUT_BYTES) s.lastValidByPage[page] = json;
          }),
      })),
      {
        name: 'meridian:layouts',
        version: 3,
        // Written in the background: 2 s after a change, at least every 30 s (see storage.ts).
        storage: createDebouncedStorage<Persisted>(PersistedSchema),
        partialize: (s): Persisted => ({
          savedLayouts: s.savedLayouts,
          activeByPage: s.activeByPage,
          shares: s.shares,
          lastValidByPage: s.lastValidByPage,
        }),
        // Version 1 differs only in naming and version 2 kept 20 versions without descriptions;
        // the schema upgrades both on load. Saved snapshots without `grid` are converted from
        // the old grid when they are applied.
        migrate: (persisted): Persisted => {
          const parsed = PersistedSchema.safeParse(persisted);
          return parsed.success
            ? parsed.data
            : { savedLayouts: [], activeByPage: {}, shares: [], lastValidByPage: {} };
        },
      },
    ),
    { name: 'LayoutStore', enabled: devtoolsEnabled },
  ),
);
