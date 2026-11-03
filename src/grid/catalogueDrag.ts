/**
 * Drag-to-add from the widget catalogue onto the grid (HTML5 drag and drop).
 *
 * Browsers only reveal drag data on drop, but the grid needs the widget's size while the
 * pointer is still moving (to draw the drop preview). The catalogue records the dragged widget
 * type here on dragstart and clears it on dragend; the type also travels in the DataTransfer
 * under CATALOGUE_DRAG_TYPE.
 */

/** DataTransfer type carrying the widget type id. */
export const CATALOGUE_DRAG_TYPE = 'application/x-meridian-widget';

/** Item id react-grid-layout uses for the drop preview. Never stored. */
export const DROPPING_ITEM_ID = '__catalogue-drop__';

let dragged: string | null = null;

export function startCatalogueDrag(widgetId: string): void {
  dragged = widgetId;
}

export function endCatalogueDrag(): void {
  dragged = null;
}

/** The widget type being dragged from the catalogue, or null. */
export function draggedCatalogueWidget(): string | null {
  return dragged;
}
