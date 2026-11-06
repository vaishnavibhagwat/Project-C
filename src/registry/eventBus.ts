/**
 * Typed publish/subscribe for cross-widget events. `EventBus<Events>` is generic over an event
 * map (event name → payload type), so `publish` and `subscribe` only accept known names and the
 * matching payload. Events are transient: nothing is stored or persisted, and a subscriber only
 * sees events published after it subscribed.
 */

/** Event name → payload. Payloads are plain objects. Works for interfaces as well as types. */
export type EventMapOf<Events> = { [K in keyof Events]: object };

export type EventHandler<P> = (payload: P) => void;

type HandlerSets<Events extends EventMapOf<Events>> = {
  [K in keyof Events]?: Set<EventHandler<Events[K]>>;
};

export class EventBus<Events extends EventMapOf<Events>> {
  private handlers: HandlerSets<Events> = {};

  /** Runs when a handler throws, so one broken widget cannot stop the others hearing an event. */
  constructor(
    private readonly onHandlerError: (error: unknown, type: keyof Events) => void = (error, type) =>
      console.error(`[eventBus] a ${String(type)} handler threw`, error),
  ) {}

  /** Calls `handler` for every later `type` event. Returns the unsubscribe function. */
  subscribe<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void {
    let set = this.handlers[type];
    if (!set) {
      set = new Set();
      this.handlers[type] = set;
    }
    set.add(handler);
    return () => {
      const current = this.handlers[type];
      current?.delete(handler);
      if (current?.size === 0) delete this.handlers[type];
    };
  }

  /**
   * Calls every handler of `type` in subscription order. Handlers added or removed while it
   * runs take effect from the next publish.
   */
  publish<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers[type];
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (error) {
        this.onHandlerError(error, type);
      }
    }
  }

  /** Number of handlers for `type` (for tests and dev tools). */
  listenerCount(type: keyof Events): number {
    return this.handlers[type]?.size ?? 0;
  }

  /** Removes every handler (tests). */
  clear(): void {
    this.handlers = {};
  }
}

/** The workstation's cross-widget events. */
export interface WidgetEventMap {
  /** A holding was picked (holdings table row). `ticker` as in the holdings, e.g. "RELIANCE". */
  SYMBOL_SELECTED: {
    ticker: string;
    /** Instance id of the widget that published it, so it can ignore its own event. */
    source: string;
  };
  /** The visible range of a time-series widget changed. Trading days, YYYY-MM-DD (IST). */
  DATE_RANGE_CHANGED: { from: string; to: string };
  /** An alert was opened. `relatedWidget` is a registry id (e.g. var-gauge). */
  ALERT_CLICKED: {
    alertId: string;
    relatedWidget: string;
    /** Ticker, or PORTFOLIO for fund-level alerts. */
    relatedEntity: string;
  };
}

export type WidgetEventName = keyof WidgetEventMap;

/** The one bus every widget uses. */
export const eventBus = new EventBus<WidgetEventMap>();
