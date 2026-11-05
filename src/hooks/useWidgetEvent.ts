import { useEffect, useRef } from 'react';
import {
  isWidgetEvent,
  subscribeWidgetEvents,
  type WidgetEventOf,
  type WidgetEventType,
} from '@/utils/widgetEvents';

/**
 * Call `handler` for each cross-widget event of `type` (e.g. SYMBOL_SELECTED). The latest
 * handler is always used without re-subscribing; the subscription is removed on unmount.
 */
export function useWidgetEvent<T extends WidgetEventType>(
  type: T,
  handler: (event: WidgetEventOf<T>) => void,
): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(
    () =>
      subscribeWidgetEvents((event) => {
        if (isWidgetEvent(event, type)) ref.current(event);
      }),
    [type],
  );
}
