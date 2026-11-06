import { useEffect, useRef } from 'react';
import { eventBus, type EventHandler, type WidgetEventMap } from '@/registry/eventBus';

/**
 * Calls `handler` for each `type` event on the app's event bus while the component is mounted,
 * and unsubscribes on unmount. The latest handler is always used, so it can read fresh props
 * and state without re-subscribing.
 */
export function useEventBus<K extends keyof WidgetEventMap>(
  type: K,
  handler: EventHandler<WidgetEventMap[K]>,
): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => eventBus.subscribe(type, (payload) => ref.current(payload)), [type]);
}
