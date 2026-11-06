import type { PluginManifest } from './types';

export type { PluginManifest, PluginRegistryApi, WidgetPlugin } from './types';

/**
 * Plugins offered in the Widget Marketplace. Only this metadata is in the main bundle; each
 * plugin's code is a separate chunk fetched when it is installed. The publisher is fictional.
 */
export const AVAILABLE_PLUGINS: readonly PluginManifest[] = [
  {
    id: 'demo-top-movers',
    name: 'Top Movers',
    publisher: 'Demo Labs (fictional third party)',
    version: '1.0.0',
    description:
      'Adds a Top Movers widget: the book’s biggest gainers and losers today. Shows how an outside package registers a widget at runtime.',
    widgetIds: ['demo-top-movers'],
    load: () => import('./demo-top-movers').then((m) => m.plugin),
  },
];
