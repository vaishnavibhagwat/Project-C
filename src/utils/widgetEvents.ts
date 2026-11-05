/**
 * Cross-widget events (hook points). Widgets subscribe with `useWidgetEvent`. The performance
 * line chart publishes DATE_RANGE_CHANGED; nothing publishes SYMBOL_SELECTED yet.
 * Module state like `data/connection.ts`, not a store: events are transient and not persisted.
 */
export interface SymbolSelectedEvent {
  type: 'SYMBOL_SELECTED';
  /** Ticker as it appears in the holdings (e.g. "RELIANCE"). */
  symbol: string;
  /** Instance id of the widget that sent it, so a widget can ignore its own events. */
  sourceInstanceId?: string;
}

/** The visible date range of a time-series widget changed (preset, zoom, pan or brush). */
export interface DateRangeChangedEvent {
  type: 'DATE_RANGE_CHANGED';
  /** First and last visible trading days, YYYY-MM-DD (IST). */
  from: string;
  to: string;
  sourceInstanceId?: string;
}

export type WidgetEvent = SymbolSelectedEvent | DateRangeChangedEvent;
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
