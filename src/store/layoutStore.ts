import { z } from 'zod';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { PageId, PageSnapshot, Layout } from '@/types';
import { sanitizeText } from '@/utils/sanitize';
import { PageIdSchema, LayoutSchema } from './schemas';
import { createId, createValidatedStorage, devtoolsEnabled } from './storage';

export const MAX_VERSIONS = 20;
export const MAX_SAVED_LAYOUTS = 30;

interface LayoutData {
  saved: Layout[];
  /** Saved layout currently loaded on each page, if any. */
  activeByPage: Partial<Record<PageId, string>>;
  /** Last share link generated (for the share dialog). */
  lastShareUrl: string | null;
}

interface LayoutActions {
  saveNew: (name: string, snapshot: PageSnapshot, nowIso: string) => string;
  saveVersion: (id: string, snapshot: PageSnapshot, note: string, nowIso: string) => number | null;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  setActive: (page: PageId, id: string | null) => void;
  setLastShareUrl: (url: string | null) => void;
}

export type LayoutState = LayoutData & LayoutActions;

const PersistedSchema = z.object({
  saved: z.array(LayoutSchema).max(MAX_SAVED_LAYOUTS),
  activeByPage: z.record(PageIdSchema, z.string()),
});
type Persisted = z.infer<typeof PersistedSchema>;

function cleanName(name: string): string {
  return sanitizeText(name, 60) || 'Untitled layout';
}

export const useLayoutStore = create<LayoutState>()(
  devtools(
    persist(
      immer((set, get) => ({
        saved: [],
        activeByPage: {},
        lastShareUrl: null,

        saveNew: (name, snapshot, nowIso) => {
          const id = createId('layout');
          set((s) => {
            if (s.saved.length >= MAX_SAVED_LAYOUTS) s.saved.shift();
            s.saved.push({
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
          const layout = get().saved.find((l) => l.id === id);
          if (!layout) return null;
          const version = (layout.versions[layout.versions.length - 1]?.version ?? 0) + 1;
          set((s) => {
            const target = s.saved.find((l) => l.id === id);
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

        rename: (id, name) =>
          set((s) => {
            const target = s.saved.find((l) => l.id === id);
            if (target) target.name = cleanName(name);
          }),

        remove: (id) =>
          set((s) => {
            s.saved = s.saved.filter((l) => l.id !== id);
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

        setLastShareUrl: (url) =>
          set((s) => {
            s.lastShareUrl = url;
          }),
      })),
      {
        name: 'meridian:layouts',
        version: 1,
        storage: createValidatedStorage<Persisted>(PersistedSchema),
        partialize: (s): Persisted => ({ saved: s.saved, activeByPage: s.activeByPage }),
      },
    ),
    { name: 'LayoutStore', enabled: devtoolsEnabled },
  ),
);
