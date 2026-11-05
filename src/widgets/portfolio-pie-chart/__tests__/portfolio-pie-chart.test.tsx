import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { publishWidgetEvent } from '@/utils/widgetEvents';
import { portfolioPieChartDefinition, summarizePortfolioPie } from '../config';
import PortfolioPieChart from '../index';
import { buildLevel, drillInto, MAX_SLICES, sliceColor } from '../model';
import type { PortfolioPieChartConfig } from '../types';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = portfolioPieChartDefinition.defaultConfig;
const withConfig = (patch: Partial<PortfolioPieChartConfig>) => ({ ...defaults, ...patch });
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const legend = () => screen.getByRole('list', { name: /allocation$/ });

describe('PortfolioPieChart model', () => {
  it('splits the whole book by asset class; slices sum to 100% and to the book value', () => {
    const level = buildLevel(data, defaults, []);
    const book = sum(data.holdings.map((h) => h.marketValue));
    expect(level.slices.map((s) => s.label).sort()).toEqual([
      'Alternatives',
      'Derivatives',
      'Equity',
      'Fixed Income',
    ]);
    expect(sum(level.slices.map((s) => s.sharePct))).toBeCloseTo(100, 6);
    expect(sum(level.slices.map((s) => s.valueInr))).toBeCloseTo(book, 0);
    expect(level.bookPct).toBeCloseTo(100, 6);
  });

  it('drills Equity into sectors, and skips the one-group sector level for Derivatives', () => {
    const top = buildLevel(data, defaults, []);
    const equity = top.slices.find((s) => s.label === 'Equity');
    const derivatives = top.slices.find((s) => s.label === 'Derivatives');
    if (!equity || !derivatives) throw new Error('fixture lacks equity or derivatives');

    const sectors = buildLevel(data, defaults, drillInto(top, equity) ?? []);
    expect(sectors.dimension).toBe('sector');
    expect(sectors.path.map((s) => s.label)).toEqual(['Equity']);
    expect(sectors.bookPct).toBeCloseTo(equity.bookPct, 6);
    expect(sum(sectors.slices.map((s) => s.sharePct))).toBeCloseTo(100, 6);

    // Futures and options have no sector, so the drill goes straight to the holdings.
    const contracts = buildLevel(data, defaults, drillInto(top, derivatives) ?? []);
    expect(contracts.dimension).toBe('holding');
    expect(contracts.slices.length).toBeGreaterThan(1);
    expect(contracts.slices.every((s) => !s.drillable)).toBe(true);
  });

  it('caps a level at MAX_SLICES with a non-drillable "Other"', () => {
    const level = buildLevel(data, withConfig({ grouping: 'sector' }), []);
    expect(level.slices.length).toBeLessThanOrEqual(MAX_SLICES);
    const other = level.slices.at(-1);
    expect(other?.isOther).toBe(true);
    expect(other?.drillable).toBe(false);
    expect(other?.label).toMatch(/^Other \(\d+ sectors\)$/);
  });

  it('groups by a custom field', () => {
    const level = buildLevel(data, withConfig({ grouping: 'custom', customField: 'currency' }), []);
    expect(level.title).toBe('Currency');
    expect(level.slices.map((s) => s.label).sort()).toEqual(['INR', 'USD']);
  });

  it('drops drill steps that no longer match the data', () => {
    const level = buildLevel(data, defaults, [
      { dimension: 'asset-class', key: 'Commodities', label: 'Commodities' },
    ]);
    expect(level.path).toEqual([]);
    expect(level.dimension).toBe('asset-class');
  });

  it('colours every palette from theme CSS variables', () => {
    const level = buildLevel(data, defaults, []);
    for (const palette of ['theme', 'monochrome', 'soft'] as const) {
      level.slices.forEach((s, i) => {
        expect(sliceColor(palette, i, s, level.slices.length)).toMatch(/^rgb\(var\(--color-/);
      });
    }
  });

  it('summarises the top level', () => {
    expect(summarizePortfolioPie(data, defaults)).toMatch(
      /^Allocation by asset class: Equity \d+\.\d%, Fixed Income \d+\.\d%, Alternatives \d+\.\d%, and 1 more\.$/,
    );
  });
});

describe('PortfolioPieChart', () => {
  it('lists every slice in the legend with its share', () => {
    render(<PortfolioPieChart {...widgetProps(defaults, data)} />);
    const items = within(legend()).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(within(legend()).getByRole('button', { name: /^Equity, \d+\.\d%/ })).toBeVisible();
  });

  it('drills into a slice and comes back with the Back button', () => {
    render(<PortfolioPieChart {...widgetProps(defaults, data)} />);
    fireEvent.click(within(legend()).getByRole('button', { name: /^Equity,/ }));
    const nav = screen.getByRole('navigation', { name: 'Drill-down' });
    expect(nav).toHaveTextContent('Equity');
    expect(screen.getByRole('list', { name: 'Sector allocation' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^Allocation by sector within Equity:/);

    fireEvent.click(within(nav).getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('navigation', { name: 'Drill-down' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Asset class allocation' })).toBeInTheDocument();
  });

  it('hovering a legend item highlights its slice and shows it in the centre', () => {
    render(<PortfolioPieChart {...widgetProps(defaults, data)} />);
    const equity = within(legend()).getByRole('button', { name: /^Equity,/ });
    expect(screen.getByText('Total')).toBeInTheDocument();
    fireEvent.mouseEnter(equity);
    expect(equity).toHaveClass('bg-raised');
    // The donut centre now names the hovered slice instead of the total.
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    fireEvent.mouseLeave(equity);
    expect(equity).not.toHaveClass('bg-raised');
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('at the default 4x3 size, shows the hovered slice in the header instead of the centre', () => {
    render(<PortfolioPieChart {...widgetProps(defaults, data, 400, 160)} />);
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    fireEvent.mouseEnter(within(legend()).getByRole('button', { name: /^Equity,/ }));
    expect(screen.getByText(/^\d+\.\d%$/, { selector: 'span.num:not(li *)' })).toBeInTheDocument();
  });

  it('switches grouping through the config, and resets the drill path', () => {
    const onConfigChange = vi.fn();
    const { rerender } = render(
      <PortfolioPieChart {...widgetProps(defaults, data, 800, 400, onConfigChange)} />,
    );
    fireEvent.click(within(legend()).getByRole('button', { name: /^Equity,/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Region' }));
    expect(onConfigChange).toHaveBeenCalledWith({ grouping: 'geography' });

    rerender(<PortfolioPieChart {...widgetProps(withConfig({ grouping: 'geography' }), data)} />);
    expect(screen.queryByRole('navigation', { name: 'Drill-down' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Geography allocation' })).toBeInTheDocument();
  });

  it('highlights the slice holding a symbol sent with SYMBOL_SELECTED (hook point)', () => {
    const stock = data.holdings.find((h) => h.assetClass === 'Equity');
    if (!stock) throw new Error('fixture has no equity');
    render(<PortfolioPieChart {...widgetProps(defaults, data)} />);
    act(() => publishWidgetEvent({ type: 'SYMBOL_SELECTED', symbol: stock.ticker }));
    expect(within(legend()).getByRole('button', { name: /^Equity,/ })).toHaveClass('bg-raised');
  });

  it('renders the configured pie without a centre total', () => {
    render(<PortfolioPieChart {...widgetProps(configuredConfig, data)} />);
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Sector allocation' })).toBeInTheDocument();
  });
});

describeWidgetStates('portfolio-pie-chart', { data: fixtureData, emptyData });
