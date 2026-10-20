import { z } from 'zod';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { PageId, WidgetConfig, WidgetInstance } from '@/types';
import { defaultSnapshot } from '@/registry/pages';
import { PAGE_IDS, WidgetInstanceSchema } from './schemas';
import { createId, createValidatedStorage, devtoolsEnabled } from './storage';

interface WidgetData {
  instances: Record<string, WidgetInstance>;
  /** Instance whose configuration panel is open (UI state, not persisted). */
  settingsFor: string | null;
}

interface WidgetActions {
  createInstance: (type: string, title: string, config?: WidgetConfig) => string;
  upsertInstances: (instances: WidgetInstance[]) => void;
  updateConfig: (id: string, patch: WidgetConfig) => void;
  replaceConfig: (id: string, config: WidgetConfig) => void;
  renameInstance: (id: string, title: string) => void;
  removeInstances: (ids: string[]) => void;
  duplicateInstance: (id: string) => string | null;
  openSettings: (id: string) => void;
  closeSettings: () => void;
}

export type WidgetState = WidgetData & WidgetActions;

function defaultInstances(): Record<string, WidgetInstance> {
  const out: Record<string, WidgetInstance> = {};
  for (const page of PAGE_IDS) {
    for (const instance of defaultSnapshot(page).instances) out[instance.id] = instance;
  }
  return out;
}

const PersistedSchema = z.object({
  instances: z.record(z.string(), WidgetInstanceSchema),
});
type Persisted = z.infer<typeof PersistedSchema>;

export const useWidgetStore = create<WidgetState>()(
  devtools(
    persist(
      immer((set, get) => ({
        instances: defaultInstances(),
        settingsFor: null,

        createInstance: (type, title, config = {}) => {
          const id = createId(type);
          set((s) => {
            s.instances[id] = { id, type, title, config };
          });
          return id;
        },

        upsertInstances: (instances) =>
          set((s) => {
            for (const instance of instances) s.instances[instance.id] = instance;
          }),

        updateConfig: (id, patch) =>
          set((s) => {
            const instance = s.instances[id];
            if (instance) instance.config = { ...instance.config, ...patch };
          }),

        replaceConfig: (id, config) =>
          set((s) => {
            const instance = s.instances[id];
            if (instance) instance.config = config;
          }),

        renameInstance: (id, title) =>
          set((s) => {
            const instance = s.instances[id];
            if (instance) instance.title = title;
          }),

        removeInstances: (ids) =>
          set((s) => {
            for (const id of ids) delete s.instances[id];
            if (s.settingsFor && ids.includes(s.settingsFor)) s.settingsFor = null;
          }),

        duplicateInstance: (id) => {
          const source = get().instances[id];
          if (!source) return null;
          const copyId = createId(source.type);
          set((s) => {
            s.instances[copyId] = {
              id: copyId,
              type: source.type,
              title: `${source.title} (copy)`.slice(0, 80),
              config: { ...source.config },
            };
          });
          return copyId;
        },

        openSettings: (id) =>
          set((s) => {
            s.settingsFor = id;
          }),

        closeSettings: () =>
          set((s) => {
            s.settingsFor = null;
          }),
      })),
      {
        name: 'meridian:widgets',
        version: 1,
        storage: createValidatedStorage<Persisted>(PersistedSchema),
        partialize: (s): Persisted => ({ instances: s.instances }),
      },
    ),
    { name: 'WidgetStore', enabled: devtoolsEnabled },
  ),
);

export function defaultInstancesFor(page: PageId): WidgetInstance[] {
  return defaultSnapshot(page).instances;
}
