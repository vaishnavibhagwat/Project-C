import type { ProfilerOnRenderCallback } from 'react';

export interface RenderSample {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  durationMs: number;
}

/** Render statistics for one widget instance since collection started. */
export interface WidgetRenderStats {
  count: number;
  /** Longest single render (React Profiler actualDuration), ms. */
  maxMs: number;
  lastMs: number;
}

declare global {
  interface Window {
    /** Set to an array (e.g. by a measurement script) to collect widget render timings. */
    __MERIDIAN_PERF__?: RenderSample[];
  }
}

const stats = new Map<string, WidgetRenderStats>();
let collecting = false;

/** Turn per-widget render statistics on or off (the Performance Overlay does this). */
export function setRenderStatsEnabled(enabled: boolean): void {
  collecting = enabled;
}

/** Forget collected render statistics. */
export function resetRenderStats(): void {
  stats.clear();
}

/** A copy of the render statistics, keyed by widget instance id. */
export function getRenderStats(): Map<string, WidgetRenderStats> {
  return new Map(Array.from(stats, ([id, s]) => [id, { ...s }]));
}

/**
 * React Profiler callback for widget bodies (`id` is the widget instance id). React only calls
 * it in development and profiling builds. It records nothing unless the Performance Overlay is
 * collecting or a measurement script opts in via window.__MERIDIAN_PERF__.
 */
export const recordWidgetRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  if (collecting) {
    const s = stats.get(id) ?? { count: 0, maxMs: 0, lastMs: 0 };
    stats.set(id, {
      count: s.count + 1,
      maxMs: Math.max(s.maxMs, actualDuration),
      lastMs: actualDuration,
    });
  }
  const sink = typeof window === 'undefined' ? undefined : window.__MERIDIAN_PERF__;
  if (!sink) return;
  sink.push({ id, phase, durationMs: actualDuration });
  if (sink.length > 5000) sink.splice(0, sink.length - 5000);
};

/** Whether React reports render timings in this build (only development and profiling do). */
export const RENDER_TIMINGS_AVAILABLE = import.meta.env.DEV;

/**
 * JS heap in use and its limit, from Chrome's non-standard `performance.memory`. Null in
 * browsers that do not expose it.
 */
export function readHeapMemory(): { usedBytes: number; limitBytes: number } | null {
  if (typeof performance === 'undefined' || !('memory' in performance)) return null;
  const memory: unknown = performance.memory;
  if (typeof memory !== 'object' || memory === null) return null;
  if (!('usedJSHeapSize' in memory) || !('jsHeapSizeLimit' in memory)) return null;
  const used = memory.usedJSHeapSize;
  const limit = memory.jsHeapSizeLimit;
  return typeof used === 'number' && typeof limit === 'number'
    ? { usedBytes: used, limitBytes: limit }
    : null;
}

/**
 * Frames per second from requestAnimationFrame. Calls `onSample` about every `windowMs` with
 * the frame rate over that window and the longest frame in it. Returns a stop function.
 */
export function startFpsMeter(
  onSample: (sample: { fps: number; worstFrameMs: number }) => void,
  windowMs = 500,
): () => void {
  let frames = 0;
  let worst = 0;
  let windowStart = performance.now();
  let last = windowStart;
  let id = requestAnimationFrame(function tick(now) {
    frames += 1;
    worst = Math.max(worst, now - last);
    last = now;
    if (now - windowStart >= windowMs) {
      onSample({ fps: (frames * 1000) / (now - windowStart), worstFrameMs: worst });
      frames = 0;
      worst = 0;
      windowStart = now;
    }
    id = requestAnimationFrame(tick);
  });
  return () => cancelAnimationFrame(id);
}
