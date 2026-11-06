import type { WidgetPlugin } from '../types';
import { topMoversWidget } from './config';

/**
 * Package entry of the demo "third-party" plugin. It is loaded as its own chunk when the user
 * installs it in the Widget Marketplace, and registers its widget through the public
 * registry API, exactly as an external package would.
 */
export const plugin: WidgetPlugin = {
  id: 'demo-top-movers',
  install(registry) {
    registry.registerWidget(topMoversWidget);
  },
  uninstall(registry) {
    registry.unregisterWidget(topMoversWidget.id);
  },
};

export { TOP_MOVERS_WIDGET_ID, topMoversDefinition, topMoversWidget } from './config';
