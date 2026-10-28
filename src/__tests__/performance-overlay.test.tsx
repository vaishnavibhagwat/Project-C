import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PerformanceOverlay from '@/layout/PerformanceOverlay';
import {
  getRenderStats,
  readHeapMemory,
  recordWidgetRender,
  resetRenderStats,
  setRenderStatsEnabled,
  startFpsMeter,
} from '@/utils/perf';
import { renderWithProviders } from './render';

afterEach(() => {
  setRenderStatsEnabled(false);
  resetRenderStats();
});

describe('render statistics', () => {
  it('count renders and keep the longest per widget only while enabled', () => {
    recordWidgetRender('nav', 'update', 3, 0, 0, 0);
    expect(getRenderStats().size).toBe(0);
    setRenderStatsEnabled(true);
    recordWidgetRender('nav', 'mount', 4, 0, 0, 0);
    recordWidgetRender('nav', 'update', 9.5, 0, 0, 0);
    recordWidgetRender('nav', 'update', 2, 0, 0, 0);
    recordWidgetRender('var', 'mount', 1, 0, 0, 0);
    expect(getRenderStats().get('nav')).toEqual({ count: 3, maxMs: 9.5, lastMs: 2 });
    expect(getRenderStats().get('var')?.count).toBe(1);
    resetRenderStats();
    expect(getRenderStats().size).toBe(0);
  });
});

describe('heap memory', () => {
  it('is null where performance.memory is not exposed (jsdom, Firefox, Safari)', () => {
    expect(readHeapMemory()).toBeNull();
  });

  it("reads Chrome's performance.memory", () => {
    Object.defineProperty(performance, 'memory', {
      configurable: true,
      value: { usedJSHeapSize: 52_428_800, jsHeapSizeLimit: 4_294_705_152 },
    });
    expect(readHeapMemory()).toEqual({ usedBytes: 52_428_800, limitBytes: 4_294_705_152 });
    Reflect.deleteProperty(performance, 'memory');
  });
});

describe('FPS meter', () => {
  it('reports frames per second and the longest frame from requestAnimationFrame', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const samples: { fps: number; worstFrameMs: number }[] = [];
    const stop = startFpsMeter((s) => samples.push(s), 500);
    // 30 frames of 16.67 ms with one 50 ms hitch: 31 frames in ~533 ms.
    let t = 0;
    for (let i = 0; i < 31; i += 1) {
      t += i === 10 ? 50 : 1000 / 60;
      callbacks[i]?.(t);
    }
    stop();
    vi.restoreAllMocks();
    expect(samples).toHaveLength(1);
    expect(samples[0]?.fps).toBeGreaterThan(55);
    expect(samples[0]?.worstFrameMs).toBeCloseTo(50, 5);
  });
});

describe('PerformanceOverlay', () => {
  it('shows FPS, heap, widgets, subscriptions and per-widget renders', () => {
    // Drive animation frames by hand so the first sample is deterministic.
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const onClose = vi.fn();
    renderWithProviders(<PerformanceOverlay onClose={onClose} />);
    const overlay = screen.getByRole('region', { name: 'Performance overlay' });
    act(() => recordWidgetRender('workstation-nav-performance', 'update', 7.25, 0, 0, 0));
    act(() => {
      for (let i = 0; i < 31; i += 1) callbacks[i]?.(((i + 1) * 1000) / 60);
    });
    vi.restoreAllMocks();

    expect(within(overlay).getByText('60')).toBeInTheDocument();
    expect(within(overlay).getByText('7.3')).toBeInTheDocument();
    expect(within(overlay).getByText('NAV vs Nifty 50')).toBeInTheDocument();
    expect(within(overlay).getByText('not exposed by this browser')).toBeInTheDocument();
    expect(within(overlay).getByText(/on 0 queries/)).toBeInTheDocument();
    expect(within(overlay).getByText(/7\.3 ms · NAV vs Nifty 50/)).toBeInTheDocument();
    fireEvent.click(within(overlay).getByRole('button', { name: 'Close performance overlay' }));
    expect(onClose).toHaveBeenCalled();
  });
});
