import type { RegisteredWidget } from '../defineWidget';
import type { WidgetRegistry } from '../WidgetRegistry';

/** The part of the registry a plugin may use. */
export type PluginRegistryApi = Pick<
  WidgetRegistry<RegisteredWidget>,
  'registerWidget' | 'unregisterWidget' | 'hasWidget' | 'getWidget'
>;

/** What a plugin package exports (as `plugin`). */
export interface WidgetPlugin {
  /** Same as its manifest id. */
  id: string;
  /** Register the plugin's widgets. May throw (invalid definition, duplicate id). */
  install: (registry: PluginRegistryApi) => void;
  /** Remove the plugin's widgets again. */
  uninstall: (registry: PluginRegistryApi) => void;
}

/** Catalogue entry for a plugin: small metadata, with the code loaded only on install. */
export interface PluginManifest {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description: string;
  /** Widget ids the plugin registers (used to clean up pages on uninstall). */
  widgetIds: readonly string[];
  load: () => Promise<WidgetPlugin>;
}
