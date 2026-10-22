import { z } from 'zod';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { GridPosition, PageId, WidgetConfig, WidgetInstance } from '@/types';
import { defaultSnapshot } from '@/registry/pages';
import { PAGE_IDS, WidgetInstanceSchema } from './schemas';
import { createId, createValidatedStorage, devtoolsEnabled } from './storage';

interface WidgetData {
  /** Widget instances keyed by instanceId. */
  instances: Record<string, WidgetInstance>;
  /** Instance whose configuration panel is open (UI state, not persisted). */
  settingsFor: string | null;
}

interface WidgetActions {
  createInstance: (
    widgetId: string,
    position: GridPosition,
    config?: WidgetConfig,
    title?: string,
  ) => string;
  upsertInstances: (instances: WidgetInstance[]) => void;
  updateConfig: (instanceId: string, patch: WidgetConfig) => void;
  replaceConfig: (instanceId: string, config: WidgetConfig) => void;
  /** Set a custom title, or clear it (undefined) to show the widget's name. */
  renameInstance: (instanceId: string, title: string | undefined) => void;
  /** Mirror desktop (lg) grid positions into the instances. */
  setPositions: (positions: Record<string, GridPosition>) => void;
  removeInstances: (instanceIds: string[]) => void;
  duplicateInstance: (instanceId: string, position: GridPosition, title?: string) => string | null;
  openSettings: (instanceId: string) => void;
  closeSettings: () => void;
}

export type WidgetState = WidgetData & WidgetActions;

function defaultInstances(): Record<string, WidgetInstance> {
  const out: Record<string, WidgetInstance> = {};
  for (const page of PAGE_IDS) {
    for (const instance of defaultSnapshot(page).instances) out[instance.instanceId] = instance;
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

        createInstance: (widgetId, position, config = {}, title) => {
          const instanceId = createId(widgetId);
          set((s) => {
            s.instances[instanceId] = { instanceId, widgetId, config, position, title };
          });
          return instanceId;
        },

        upsertInstances: (instances) =>
          set((s) => {
            for (const instance of instances) s.instances[instance.instanceId] = instance;
          }),

        updateConfig: (instanceId, patch) =>
          set((s) => {
            const instance = s.instances[instanceId];
            if (instance) instance.config = { ...instance.config, ...patch };
          }),

        replaceConfig: (instanceId, config) =>
          set((s) => {
            const instance = s.instances[instanceId];
            if (instance) instance.config = config;
          }),

        renameInstance: (instanceId, title) =>
          set((s) => {
            const instance = s.instances[instanceId];
            if (instance) instance.title = title;
          }),

        setPositions: (positions) =>
          set((s) => {
            for (const [instanceId, position] of Object.entries(positions)) {
              const instance = s.instances[instanceId];
              if (instance) instance.position = position;
            }
          }),

        removeInstances: (instanceIds) =>
          set((s) => {
            for (const id of instanceIds) delete s.instances[id];
            if (s.settingsFor && instanceIds.includes(s.settingsFor)) s.settingsFor = null;
          }),

        duplicateInstance: (instanceId, position, title) => {
          const source = get().instances[instanceId];
          if (!source) return null;
          const copyId = createId(source.widgetId);
          set((s) => {
            s.instances[copyId] = {
              instanceId: copyId,
              widgetId: source.widgetId,
              config: { ...source.config },
              position,
              title,
            };
          });
          return copyId;
        },

        openSettings: (instanceId) =>
          set((s) => {
            s.settingsFor = instanceId;
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
