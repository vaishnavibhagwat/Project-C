import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { eventBus, type WidgetEventMap } from '@/registry/eventBus';
import { performanceLineChartDefinition, summarizePerformanceLine } from '../config';
import PerformanceLineChart, { DATE_RANGE_DEBOUNCE_MS } from '../index';
import {
  clampWindow,
  customLevels,
  MIN_WINDOW_POINTS,
  panWindow,
  presetWindow,
  rebasedRows,
  scaleWindow,
  selectedSeries,
  seriesStyle,
  zoomTo,
} from '../model';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = performanceLineChartDefinition.defaultConfig;
const n = data.dates.length;
const last = data.dates[n - 1] ?? '';

afterEach(() => {
  vi.useRealTimers();
});

describe('PerformanceLineChart model', () => {
  it('serves the fund and six benchmarks on the same trading days', () => {
    expect(data.benchmarks.map((b) => b.id)).toEqual([
      'NIFTY50',
      'SENSEX',
      'SPX',
      'NIFTYBANK',
      'NIFTYIT',
      'NIFTYPHARMA',
    ]);
    expect(data.fund).toHaveLength(n);
    for (const b of data.benchmarks) expect(b.levels).toHaveLength(n);
  });

  it('starts presets on the last close on or before the period start', () => {
    const oneYear = presetWindow(data.dates, '1Y');
    const target = `${Number(last.slice(0, 4)) - 1}${last.slice(4)}`;
    expect(data.dates[oneYear.start] ?? '').toBe(
      data.dates.filter((d) => d <= target).at(-1) ?? '',
    );
    expect(oneYear.end).toBe(n - 1);

    const ytd = presetWindow(data.dates, 'YTD');
    expect(data.dates[ytd.start]?.slice(0, 4)).toBe(String(Number(last.slice(0, 4)) - 1));
    expect(data.dates[ytd.start + 1]?.slice(0, 4)).toBe(last.slice(0, 4));

    expect(presetWindow(data.dates, 'MAX').start).toBe(0);
    const week = presetWindow(data.dates, '1W');
    expect(week.end - week.start).toBeGreaterThanOrEqual(4);
    expect(week.end - week.start).toBeLessThanOrEqual(6);
  });

  it('rebases every series to 100 on the first visible day', () => {
    const series = selectedSeries(data, configuredConfig);
    const win = presetWindow(data.dates, '6M');
    const rows = rebasedRows(data.dates, series, win.start);
    for (const s of series) expect(rows[win.start]?.[s.key]).toBeCloseTo(100, 10);
    const fund = data.fund;
    expect(rows[n - 1]?.FUND).toBeCloseTo(((fund[n - 1] ?? 0) / (fund[win.start] ?? 1)) * 100, 8);
  });

  it('builds the custom blend from the Nifty 50 and S&P 500 returns', () => {
    const level = (id: string, t: number) =>
      data.benchmarks.find((b) => b.id === id)?.levels[t] ?? NaN;
    const allNifty = customLevels(data, 100);
    const allSpx = customLevels(data, 0);
    expect(allNifty[n - 1]).toBeCloseTo((level('NIFTY50', n - 1) / level('NIFTY50', 0)) * 100, 6);
    expect(allSpx[n - 1]).toBeCloseTo((level('SPX', n - 1) / level('SPX', 0)) * 100, 6);
    const blend = customLevels(data, 60);
    const r = (id: string) => level(id, 1) / level(id, 0) - 1;
    expect(blend[1]).toBeCloseTo(100 * (1 + 0.6 * r('NIFTY50') + 0.4 * r('SPX')), 10);
  });

  it('zooms, pans and clamps windows inside the data', () => {
    expect(zoomTo(40, 10, n)).toEqual({ start: 10, end: 40 });
    const tiny = zoomTo(10, 11, n);
    expect(tiny.end - tiny.start + 1).toBe(MIN_WINDOW_POINTS);
    const win = { start: 100, end: 199 };
    expect(panWindow(win, 1, n)).toEqual({ start: 110, end: 209 });
    expect(panWindow({ start: 0, end: 99 }, -1, n)).toEqual({ start: 0, end: 99 });
    expect(panWindow({ start: n - 100, end: n - 1 }, 1, n)).toEqual({ start: n - 100, end: n - 1 });
    expect(scaleWindow(win, 0.5, n)).toEqual({ start: 125, end: 174 });
    expect(clampWindow({ start: -5, end: n + 10 }, n)).toEqual({ start: 0, end: n - 1 });
  });

  it('colours lines from theme variables; benchmarks avoid the fund colour', () => {
    const series = selectedSeries(data, { ...configuredConfig, benchmarkColors: 'series' });
    const styles = seriesStyle({ ...configuredConfig, benchmarkColors: 'series' }, series);
    expect(styles.FUND?.stroke).toBe('rgb(var(--color-chart-3))');
    for (const s of series) {
      expect(styles[s.key]?.stroke).toMatch(/^rgb\(var\(--color-/);
      if (s.key !== 'FUND') expect(styles[s.key]?.stroke).not.toBe(styles.FUND?.stroke);
    }
    const accentFund = seriesStyle({ ...defaults, fundColor: 'accent' }, series);
    expect(Object.values(accentFund).map((st) => st.stroke)).not.toContain(
      'rgb(var(--color-chart-1))',
    );
    const muted = seriesStyle(configuredConfig, series);
    expect(new Set(series.slice(1).map((s) => muted[s.key]?.dash)).size).toBe(series.length - 1);
  });

  it('summarises the preset window', () => {
    expect(summarizePerformanceLine(data, defaults)).toMatch(
      /^From .+ to .+, rebased to 100: Fund NAV [+−-]\d+\.\d%, Nifty 50 [+−-]\d+\.\d%, S&P 500 [+−-]\d+\.\d%\.$/,
    );
  });
});

describe('PerformanceLineChart', () => {
  const chart = () => screen.getByRole('group', { name: /^Performance chart/ });

  it('shows a legend entry for the fund and each chosen benchmark', () => {
    render(<PerformanceLineChart {...widgetProps(defaults, data)} />);
    const legend = screen.getByRole('list', { name: 'Series' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Fund', 'Nifty 50', 'S&P 500']);
  });

  it('changes preset and log scale through the config', () => {
    const onConfigChange = vi.fn();
    render(<PerformanceLineChart {...widgetProps(defaults, data, 800, 400, onConfigChange)} />);
    fireEvent.click(screen.getByRole('radio', { name: 'MAX' }));
    expect(onConfigChange).toHaveBeenCalledWith({ range: 'MAX' });
    const log = screen.getByRole('button', { name: 'Log' });
    expect(log).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(log);
    expect(onConfigChange).toHaveBeenCalledWith({ logScale: true });
  });

  it('pans and zooms from the keyboard, and Home resets', () => {
    render(<PerformanceLineChart {...widgetProps(defaults, data)} />);
    const status = screen.getByRole('status');
    const before = status.textContent;
    fireEvent.keyDown(chart(), { key: 'ArrowLeft' });
    expect(status.textContent).not.toBe(before);
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeInTheDocument();
    fireEvent.keyDown(chart(), { key: 'Home' });
    expect(status.textContent).toBe(before);
    fireEvent.keyDown(chart(), { key: '+' });
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(screen.queryByRole('button', { name: 'Reset zoom' })).not.toBeInTheDocument();
  });

  it('publishes DATE_RANGE_CHANGED once the range settles, not on first render', () => {
    vi.useFakeTimers();
    const events: WidgetEventMap['DATE_RANGE_CHANGED'][] = [];
    const stop = eventBus.subscribe('DATE_RANGE_CHANGED', (e) => events.push(e));
    render(<PerformanceLineChart {...widgetProps(defaults, data)} />);
    act(() => {
      vi.advanceTimersByTime(DATE_RANGE_DEBOUNCE_MS * 2);
    });
    expect(events).toEqual([]);

    fireEvent.keyDown(chart(), { key: 'ArrowLeft' });
    fireEvent.keyDown(chart(), { key: 'ArrowLeft' });
    act(() => {
      vi.advanceTimersByTime(DATE_RANGE_DEBOUNCE_MS + 10);
    });
    stop();
    expect(events).toHaveLength(1);
    const [event] = events;
    if (!event) throw new Error('no event');
    expect(event.from < event.to).toBe(true);
    expect(event.to < last).toBe(true);
  });
});

describeWidgetStates('performance-line-chart', { data: fixtureData, emptyData });
