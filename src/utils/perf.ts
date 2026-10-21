import type { ProfilerOnRenderCallback } from 'react';

export interface RenderSample {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  durationMs: number;
}

declare global {
  interface Window {
    /** Set to an array (e.g. by a measurement script) to collect widget render timings. */
    __MERIDIAN_PERF__?: RenderSample[];
  }
}

/**
 * React Profiler callback for widget bodies. React only calls it in development/profiling
 * builds, and it records nothing unless a measurement script opts in via window.__MERIDIAN_PERF__.
 */
export const recordWidgetRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  const sink = typeof window === 'undefined' ? undefined : window.__MERIDIAN_PERF__;
  if (!sink) return;
  sink.push({ id, phase, durationMs: actualDuration });
  if (sink.length > 5000) sink.splice(0, sink.length - 5000);
};
