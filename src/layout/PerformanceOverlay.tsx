import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@/components/Button';
import { IconClose, IconRotate } from '@/components/Icons';
import { widgetRegistry } from '@/registry/registry';
import { useWidgetStore } from '@/store/widgetStore';
import { cx } from '@/utils/cx';
import {
  getRenderStats,
  readHeapMemory,
  RENDER_TIMINGS_AVAILABLE,
  resetRenderStats,
  setRenderStatsEnabled,
  startFpsMeter,
  type WidgetRenderStats,
} from '@/utils/perf';

const HISTORY = 60; // samples kept for the sparkline (30 s at 2 per second)

interface Sample {
  fps: number;
  worstFrameMs: number;
  heap: { usedBytes: number; limitBytes: number } | null;
  widgets: number;
  activeQueries: number;
  subscriptions: number;
  renders: [string, WidgetRenderStats][];
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function widgetLabel(instanceId: string): string {
  const instance = useWidgetStore.getState().instances[instanceId];
  if (!instance) return instanceId;
  return instance.title ?? widgetRegistry.getWidget(instance.widgetId)?.name ?? instance.widgetId;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 220;
  const h = 28;
  const points = values
    .map((v, i) => `${(i / (HISTORY - 1)) * w},${h - (Math.min(v, 60) / 60) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} aria-hidden="true" className="block">
      <line
        x1={0}
        x2={w}
        y1={h - (55 / 60) * h}
        y2={h - (55 / 60) * h}
        className="stroke-line"
        strokeDasharray="2 2"
      />
      <polyline points={points} fill="none" strokeWidth={1.5} className="stroke-accent" />
    </svg>
  );
}

/**
 * Developer overlay (Ctrl+Shift+P): FPS from requestAnimationFrame, JS heap (Chrome only),
 * mounted widgets, TanStack Query subscriptions, and render count / longest render per widget
 * from the React Profiler (development builds only). Sampled twice a second.
 */
export default function PerformanceOverlay({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const [sample, setSample] = useState<Sample | null>(null);
  const [fpsHistory, setFpsHistory] = useState<number[]>([]);

  useEffect(() => {
    resetRenderStats();
    setRenderStatsEnabled(true);
    const stop = startFpsMeter(({ fps, worstFrameMs }) => {
      const queries = client.getQueryCache().getAll();
      const active = queries.filter((q) => q.getObserversCount() > 0);
      setSample({
        fps,
        worstFrameMs,
        heap: readHeapMemory(),
        widgets: document.querySelectorAll('section[data-testid^="widget-"]').length,
        activeQueries: active.length,
        subscriptions: active.reduce((n, q) => n + q.getObserversCount(), 0),
        renders: Array.from(getRenderStats()).sort((a, b) => b[1].count - a[1].count),
      });
      setFpsHistory((h) => [...h.slice(-(HISTORY - 1)), fps]);
    });
    return () => {
      stop();
      setRenderStatsEnabled(false);
    };
  }, [client]);

  const longest = sample?.renders.reduce<[string, WidgetRenderStats] | null>(
    (best, r) => (!best || r[1].maxMs > best[1].maxMs ? r : best),
    null,
  );
  const minFps = fpsHistory.length > 0 ? Math.min(...fpsHistory) : null;
  const fpsTone = (fps: number) => (fps >= 55 ? 'text-pos' : fps >= 30 ? 'text-warn' : 'text-neg');

  return createPortal(
    <section
      role="region"
      aria-label="Performance overlay"
      className="num fixed bottom-3 right-3 z-[75] w-72 rounded-md border border-line-strong bg-panel/95 text-xs text-fg shadow-xl"
    >
      <header className="flex items-center gap-1 border-b border-line px-2 py-1">
        <h2 className="flex-1 text-2xs font-semibold uppercase tracking-wide text-muted">
          Performance · Ctrl+Shift+P
        </h2>
        <IconButton
          label="Reset render counts"
          icon={IconRotate}
          size="xs"
          onClick={resetRenderStats}
        />
        <IconButton
          label="Close performance overlay"
          icon={IconClose}
          size="xs"
          onClick={onClose}
        />
      </header>
      <div className="flex flex-col gap-2 p-2">
        <div className="flex items-baseline gap-2">
          <span
            className={cx(
              'text-2xl font-semibold leading-none',
              sample ? fpsTone(sample.fps) : 'text-muted',
            )}
          >
            {sample ? sample.fps.toFixed(0) : '–'}
          </span>
          <span className="text-muted">FPS</span>
          <span className="ml-auto text-2xs text-subtle">
            min {minFps === null ? '–' : minFps.toFixed(0)} · worst frame{' '}
            {sample ? `${sample.worstFrameMs.toFixed(1)} ms` : '–'}
          </span>
        </div>
        <Sparkline values={fpsHistory} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt className="text-muted">JS heap</dt>
          <dd className="text-right">
            {sample?.heap
              ? `${mb(sample.heap.usedBytes)} / ${mb(sample.heap.limitBytes)}`
              : 'not exposed by this browser'}
          </dd>
          <dt className="text-muted">Active widgets</dt>
          <dd className="text-right">{sample?.widgets ?? '–'}</dd>
          <dt className="text-muted">Subscriptions</dt>
          <dd className="text-right">
            {sample ? `${sample.subscriptions} on ${sample.activeQueries} queries` : '–'}
          </dd>
          <dt className="text-muted">Longest render</dt>
          <dd className="truncate text-right">
            {longest ? `${longest[1].maxMs.toFixed(1)} ms · ${widgetLabel(longest[0])}` : '–'}
          </dd>
        </dl>
        {RENDER_TIMINGS_AVAILABLE ? (
          <table className="w-full">
            <caption className="pb-0.5 text-left text-2xs text-subtle">
              Renders per widget since opened
            </caption>
            <thead className="text-2xs text-subtle">
              <tr>
                <th className="text-left font-normal">Widget</th>
                <th className="text-right font-normal">Count</th>
                <th className="text-right font-normal">Max ms</th>
              </tr>
            </thead>
            <tbody>
              {(sample?.renders ?? []).slice(0, 10).map(([id, s]) => (
                <tr key={id}>
                  <td className="max-w-0 truncate pr-2">{widgetLabel(id)}</td>
                  <td className="text-right">{s.count}</td>
                  <td className="text-right">{s.maxMs.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-2xs text-subtle">
            Render counts need a development build (npm run dev): React only reports render timings
            there.
          </p>
        )}
      </div>
    </section>,
    document.body,
  );
}
