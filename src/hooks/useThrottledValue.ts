import { useEffect, useRef, useState } from 'react';

/**
 * Pass `value` through at most once per `intervalMs`. Used for screen-reader live regions so
 * ticking prices do not flood assistive technology with announcements. The first change after
 * mount passes through immediately so the initial summary is never delayed.
 */
export function useThrottledValue<T>(value: T, intervalMs: number): T {
  const [throttled, setThrottled] = useState(value);
  const last = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return undefined;
    }
    const elapsed = Date.now() - last.current;
    if (elapsed >= intervalMs) {
      last.current = Date.now();
      setThrottled(value);
      return undefined;
    }
    const id = setTimeout(() => {
      last.current = Date.now();
      setThrottled(value);
    }, intervalMs - elapsed);
    return () => clearTimeout(id);
  }, [value, intervalMs]);

  return throttled;
}
