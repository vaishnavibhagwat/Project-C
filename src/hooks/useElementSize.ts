import { useCallback, useEffect, useRef, useState } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Measure an element with ResizeObserver. Updates are batched to one per animation frame so
 * a resize drag does not re-render the widget more often than the screen paints.
 */
export function useElementSize<T extends HTMLElement>(): [(node: T | null) => void, ElementSize] {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  const observer = useRef<ResizeObserver | null>(null);
  const frame = useRef<number | null>(null);

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setSize((prev) =>
          Math.round(prev.width) === Math.round(width) &&
          Math.round(prev.height) === Math.round(height)
            ? prev
            : { width: Math.round(width), height: Math.round(height) },
        );
      });
    });
    ro.observe(node);
    observer.current = ro;
  }, []);

  useEffect(
    () => () => {
      observer.current?.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return [ref, size];
}
