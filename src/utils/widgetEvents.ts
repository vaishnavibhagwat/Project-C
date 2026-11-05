/**
 * Cross-widget events (hook point). Widgets subscribe with `useWidgetEvent`; nothing publishes
 * yet. A later prompt wires publishers (e.g. a holdings-table row click sends SYMBOL_SELECTED).
 * Module state like `data/connection.ts`, not a store: events are transient and not persisted.
 */
export interface SymbolSelectedEvent {
  type: 'SYMBOL_SELECTED';
  /** Ticker as it appears in the holdings (e.g. "RELIANCE"). */
  symbol: string;
  /** Instance id of the widget that sent it, so a widget can ignore its own events. */
  sourceInstanceId?: string;
}

export type WidgetEvent = SymbolSelectedEvent;
export type WidgetEventType = WidgetEvent['type'];
export type WidgetEventOf<T extends WidgetEventType> = Extract<WidgetEvent, { type: T }>;

type Listener = (event: WidgetEvent) => void;
const listeners = new Set<Listener>();

export function publishWidgetEvent(event: WidgetEvent): void {
  for (const listener of [...listeners]) listener(event);
}

/** Subscribe to every widget event; returns the unsubscribe function. */
export function subscribeWidgetEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isWidgetEvent<T extends WidgetEventType>(
  event: WidgetEvent,
  type: T,
): event is WidgetEventOf<T> {
  return event.type === type;
}
