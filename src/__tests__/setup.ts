import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { setSimulatedOutage } from '@/data/connection';

/** jsdom has no layout engine; report a fixed size so measured widgets render. */
class FixedSizeResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element): void {
    const rect = { width: 800, height: 400, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 400 };
    const entry: ResizeObserverEntry = {
      target,
      contentRect: { ...rect, toJSON: () => rect },
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    };
    this.callback([entry], this);
  }
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = FixedSizeResizeObserver;

// jsdom does not implement scrolling; every browser has scrollIntoView.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => undefined;
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  localStorage.clear();
  setSimulatedOutage(false);
});

afterEach(() => {
  cleanup();
});
