import type { GridSize } from '@/types';

/**
 * Widget type of an empty slot added by the grid toolbar's "Add widget". Not a registered
 * widget (it has no data source and is not in the marketplace): the grid renders it as a slot
 * where the user picks a widget. The leading underscores mean it can never clash with a
 * registry id, which must be kebab-case.
 */
export const PLACEHOLDER_WIDGET_ID = '__placeholder';

/** Size of a new empty slot on the default grid (12 columns, 60 px rows). */
export const PLACEHOLDER_SIZE: Readonly<GridSize> = { w: 4, h: 3 };

export function isPlaceholder(widgetId: string): boolean {
  return widgetId === PLACEHOLDER_WIDGET_ID;
}
