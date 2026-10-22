import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void): () => void {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

const getWidth = () => window.innerWidth;

/** Window width in CSS px (as `min-width` media queries see it), updated on resize. */
export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, getWidth, () => 1440);
}
