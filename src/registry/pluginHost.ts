import { useSyncExternalStore } from 'react';
import { PAGE_IDS } from '@/store/schemas';
import { removeWidgetFromPage } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import { AVAILABLE_PLUGINS, type PluginManifest, type WidgetPlugin } from './plugins';
import { widgetRegistry } from './registry';

/** Plugins whose code has run `install` in this session, by id. */
const loaded = new Map<string, WidgetPlugin>();
const pending = new Map<string, Promise<boolean>>();

export function pluginManifest(id: string): PluginManifest | undefined {
  return AVAILABLE_PLUGINS.find((p) => p.id === id);
}

/** Whether a plugin's widgets are registered right now. */
export function isPluginActive(id: string): boolean {
  return loaded.has(id);
}

async function activate(manifest: PluginManifest): Promise<boolean> {
  if (loaded.has(manifest.id)) return true;
  const running = pending.get(manifest.id);
  if (running) return running;
  const job = manifest
    .load()
    .then((plugin) => {
      plugin.install(widgetRegistry);
      loaded.set(manifest.id, plugin);
      return true;
    })
    .catch((error: unknown) => {
      console.error(`Plugin "${manifest.id}" could not be installed`, error);
      return false;
    })
    .finally(() => pending.delete(manifest.id));
  pending.set(manifest.id, job);
  return job;
}

/**
 * Load a plugin's chunk and let it register its widgets through the registry API. The id is
 * remembered (DashboardStore) so the plugin is installed again after a reload. Resolves
 * false when the plugin is unknown or its code fails to load or register.
 */
export async function installPlugin(id: string): Promise<boolean> {
  const manifest = pluginManifest(id);
  if (!manifest) return false;
  const ok = await activate(manifest);
  if (ok) useDashboardStore.getState().setPluginInstalled(id, true);
  return ok;
}

/** Remove a plugin: its widgets leave every page, then the registry. Returns the count removed. */
export function uninstallPlugin(id: string): number {
  const manifest = pluginManifest(id);
  if (!manifest) return 0;
  const ids = new Set(manifest.widgetIds);
  const { instances } = useWidgetStore.getState();
  let removed = 0;
  for (const page of PAGE_IDS) {
    for (const instanceId of useDashboardStore.getState().pages[page].itemIds) {
      const instance = instances[instanceId];
      if (instance && ids.has(instance.widgetId) && removeWidgetFromPage(page, instanceId)) {
        removed += 1;
      }
    }
  }
  const plugin = loaded.get(id);
  if (plugin) plugin.uninstall(widgetRegistry);
  else for (const widgetId of ids) widgetRegistry.unregisterWidget(widgetId);
  loaded.delete(id);
  useDashboardStore.getState().setPluginInstalled(id, false);
  return removed;
}

/** Re-install the plugins saved from earlier sessions (called once by the app shell). */
export function restoreInstalledPlugins(): Promise<boolean[]> {
  const ids = useDashboardStore.getState().installedPlugins;
  return Promise.all(
    ids.map(async (id) => {
      const manifest = pluginManifest(id);
      const ok = manifest ? await activate(manifest) : false;
      // Forget a plugin that no longer exists or fails to load; its widgets show "unavailable".
      if (!ok) useDashboardStore.getState().setPluginInstalled(id, false);
      return ok;
    }),
  );
}

/** Re-render when widgets are registered or removed (e.g. a plugin was installed). */
export function useRegistryVersion(): number {
  return useSyncExternalStore(widgetRegistry.subscribe, widgetRegistry.getVersion);
}
