import { useEffect, useState } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Measure an element with ResizeObserver. Updates are batched to one per animation frame so
 * a resize drag does not re-render the widget more often than the screen paints.
 *
 * The observer lives in an effect keyed on the node, so React StrictMode's mount → unmount →
 * mount cycle in development recreates it instead of leaving it disconnected.
 */
export function useElementSize<T extends HTMLElement>(): [(node: T | null) => void, ElementSize] {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    let frame: number | null = null;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        setSize((prev) =>
          prev.width === width && prev.height === height ? prev : { width, height },
        );
      });
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [node]);

  return [setNode, size];
}
