import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { publishWidgetEvent } from '@/utils/widgetEvents';
import { attributionBarChartDefinition, summarizeAttributionBars } from '../config';
import AttributionBarChart from '../index';
import {
  attributeWindow,
  betaBucket,
  formatUnit,
  holdingContributions,
  inUnit,
  periodWindows,
} from '../model';
import type { Grouping } from '../types';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = attributionBarChartDefinition.defaultConfig;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const last = data.dates[data.dates.length - 1] ?? '';

describe('attribution inputs', () => {
  it('serve about 300 days of values for every position and the Nifty 50', () => {
    expect(data.dates.length).toBeGreaterThanOrEqual(280);
    expect(data.positions.length).toBe(62);
    expect(data.benchmark.length).toBe(50);
    expect(sum(Object.values(data.policy.weightsPct))).toBe(100);
  });
});

describe('AttributionBarChart model', () => {
  const windows = periodWindows(data.dates);

  it('finds this month, last month and the same month last year', () => {
    expect(windows.map((w) => w.key)).toEqual(['mtd', 'prev', 'yoy']);
    const [mtd, prev, yoy] = windows;
    if (!mtd || !prev || !yoy) throw new Error('missing window');
    const month = last.slice(0, 7);
    expect(mtd.to).toBe(last);
    expect(mtd.from < `${month}-01`).toBe(true);
    expect(data.dates[mtd.start + 1]?.slice(0, 7)).toBe(month);
    expect(prev.end).toBe(mtd.start);
    const lastYear = `${Number(last.slice(0, 4)) - 1}${last.slice(4, 7)}`;
    expect(yoy.to.slice(0, 7)).toBe(lastYear);
    expect(data.dates[yoy.start + 1]?.slice(0, 7)).toBe(lastYear);
  });

  it.each<Grouping>(['sector', 'factor', 'asset-class'])(
    '%s: effects add up to the active return, weights to 100%%',
    (grouping) => {
      for (const w of windows) {
        const a = attributeWindow(data, grouping, w);
        expect(a.allocation + a.selection + a.interaction).toBeCloseTo(a.active, 10);
        expect(sum(a.segments.map((s) => s.portfolioWeight))).toBeCloseTo(1, 10);
        expect(sum(a.segments.map((s) => s.benchmarkWeight))).toBeCloseTo(1, 10);
        expect(a.active).toBeCloseTo(a.portfolioReturn - a.benchmarkReturn, 12);
      }
    },
  );

  it('splits a segment into holding contributions that add up to selection + interaction', () => {
    const w = windows[0];
    if (!w) throw new Error('no window');
    const a = attributeWindow(data, 'sector', w);
    const seg = a.segments[0];
    if (!seg) throw new Error('no segment');
    const items = holdingContributions(data, 'sector', a, seg.key);
    expect(items.length).toBeGreaterThan(1);
    expect(sum(items.map((i) => i.contribution))).toBeCloseTo(seg.selection + seg.interaction, 12);
    expect(sum(items.map((i) => i.weight))).toBeCloseTo(seg.portfolioWeight, 12);
  });

  it('gives derivatives no policy weight in the asset-class view', () => {
    const w = windows[0];
    if (!w) throw new Error('no window');
    const deriv = attributeWindow(data, 'asset-class', w).segments.find(
      (s) => s.key === 'Derivatives',
    );
    expect(deriv?.benchmarkWeight).toBe(0);
    expect(deriv?.allocation).toBeCloseTo(0, 12);
  });

  it('buckets beta, converts units and adds a DATE_RANGE_CHANGED window', () => {
    expect([betaBucket(1.2), betaBucket(1), betaBucket(0.7)]).toEqual([
      'High beta (β ≥ 1.1)',
      'Market beta',
      'Low beta (β < 0.9)',
    ]);
    expect(inUnit(0.0012, 'bps', 0.004)).toBeCloseTo(12, 10);
    expect(inUnit(0.001, 'pct', 0.004)).toBeCloseTo(25, 10);
    expect(inUnit(0.001, 'pct', 0.0001)).toBe(0);
    expect(formatUnit(-12.4, 'bps')).toBe('−12 bps');
    const from = data.dates[data.dates.length - 60] ?? '';
    const withRange = periodWindows(data.dates, { from, to: last });
    expect(withRange.at(-1)).toMatchObject({ key: 'range', from, to: last });
  });

  it('summarises the chosen period', () => {
    expect(summarizeAttributionBars(data, defaults)).toMatch(
      /^This month \(.+\), by sector: active return [+−]?\d+ bps \(allocation .+, selection .+, interaction .+\)\. Largest: .+\.$/,
    );
  });
});

describe('AttributionBarChart', () => {
  it('changes grouping, layout, units and compare through the config', () => {
    const onConfigChange = vi.fn();
    renderWithProviders(
      <AttributionBarChart {...widgetProps(defaults, data, 640, 300, onConfigChange)} />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Factor' }));
    expect(onConfigChange).toHaveBeenCalledWith({ grouping: 'factor' });
    fireEvent.click(screen.getByRole('radio', { name: 'Grouped' }));
    expect(onConfigChange).toHaveBeenCalledWith({ layout: 'grouped' });
    fireEvent.click(screen.getByRole('radio', { name: '%' }));
    expect(onConfigChange).toHaveBeenCalledWith({ unit: 'pct' });
    fireEvent.click(screen.getByRole('button', { name: 'Compare periods' }));
    expect(onConfigChange).toHaveBeenCalledWith({ compare: true });
  });

  it('drills into a segment from the keyboard-friendly picker, and Back returns', () => {
    renderWithProviders(<AttributionBarChart {...widgetProps(defaults, data, 640, 300)} />);
    fireEvent.click(screen.getByRole('button', { name: /^Drill into:/ }));
    const w = periodWindows(data.dates)[0];
    if (!w) throw new Error('no window');
    const seg = attributeWindow(data, 'sector', w).segments[0];
    if (!seg) throw new Error('no segment');
    fireEvent.click(screen.getByRole('menuitemradio', { name: seg.label }));
    const nav = screen.getByRole('navigation', { name: 'Attribution level' });
    expect(nav).toHaveTextContent(`${seg.label}: holding contributions`);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('navigation', { name: 'Attribution level' })).not.toBeInTheDocument();
  });

  it('lists the compared periods left to right', () => {
    renderWithProviders(<AttributionBarChart {...widgetProps(configuredConfig, data, 640, 300)} />);
    expect(
      screen.getByText('Left to right: This month, Last month, Same month LY'),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/\(total\)$/)).toHaveLength(3);
  });

  it('reacts to DATE_RANGE_CHANGED with a "Selected range" period', () => {
    renderWithProviders(<AttributionBarChart {...widgetProps(defaults, data, 640, 300)} />);
    const from = data.dates[data.dates.length - 40] ?? '';
    act(() => publishWidgetEvent({ type: 'DATE_RANGE_CHANGED', from, to: last }));
    expect(screen.getByRole('button', { name: /^Period: Selected range/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^Selected range/);
    fireEvent.click(screen.getByRole('button', { name: 'Remove the selected range' }));
    expect(screen.getByRole('button', { name: /^Period: This month/ })).toBeInTheDocument();
  });
});

describeWidgetStates('attribution-bar-chart', { data: fixtureData, emptyData });
