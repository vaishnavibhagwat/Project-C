import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { RETURNS_LOOKBACK_DAYS } from '@/data/derive/returns';
import { correlation } from '@/utils/finance';
import { correlationColor } from '../colors';
import { correlationMatrixDefinition, summarizeCorrelations } from '../config';
import CorrelationMatrix from '../index';
import {
  buildMatrix,
  cellLabel,
  formatCorrelation,
  formatCorrelationShort,
  pairStats,
  selectSeries,
} from '../model';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = correlationMatrixDefinition.defaultConfig;

describe('risk/returns', () => {
  it('serves 252 daily returns for the 15 largest holdings and each sector', () => {
    expect(data.dates).toHaveLength(RETURNS_LOOKBACK_DAYS);
    expect(data.holdings).toHaveLength(15);
    expect(data.sectors.length).toBeGreaterThanOrEqual(10);
    const weights = data.holdings.map((h) => h.weightPct);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
    expect(data.holdings.some((h) => h.label === 'CASH' || /T-?bill/i.test(h.name))).toBe(false);
  });
});

describe('CorrelationMatrix model', () => {
  it('cuts the configured count and lookback', () => {
    const { dates, series } = selectSeries(data, defaults);
    expect(dates).toHaveLength(90);
    expect(series).toHaveLength(10);
    expect(series.every((s) => s.returns.length === 90)).toBe(true);
    expect(selectSeries(data, configuredConfig).series[0]?.returns).toHaveLength(252);
  });

  it('is symmetric with ones on the diagonal and matches finance.correlation', () => {
    const { series } = selectSeries(data, defaults);
    const m = buildMatrix(series);
    series.forEach((_, i) => {
      expect(m[i]?.[i]).toBe(1);
      series.forEach((__, j) => {
        expect(m[i]?.[j]).toBeCloseTo(m[j]?.[i] ?? NaN, 12);
        expect(Math.abs(m[i]?.[j] ?? 2)).toBeLessThanOrEqual(1 + 1e-12);
      });
    });
    const [a, b] = series;
    if (!a || !b) throw new Error('need two series');
    expect(m[0]?.[1]).toBeCloseTo(correlation(a.returns, b.returns), 12);
  });

  it('reverses RdBu: −1 blue, 0 white, +1 red', () => {
    const rgb = (c: string) => (c.match(/\d+/g) ?? []).map(Number);
    const [r1, , b1] = rgb(correlationColor(1));
    const [rm, gm, bm] = rgb(correlationColor(0));
    const [rn, , bn] = rgb(correlationColor(-1));
    expect(r1).toBeGreaterThan(b1 ?? 0);
    expect(bn).toBeGreaterThan(rn ?? 0);
    expect(Math.min(rm ?? 0, gm ?? 0, bm ?? 0)).toBeGreaterThan(230);
  });

  it('labels cells and works out pair statistics', () => {
    const { dates, series } = selectSeries(data, defaults);
    const [a, b] = series;
    if (!a || !b) throw new Error('need two series');
    expect(cellLabel(a, b, 0.6234)).toBe(`${a.label} vs ${b.label}: 0.62`);
    expect(formatCorrelation(-0.41)).toBe('−0.41');
    expect(formatCorrelationShort(-0.41)).toBe('−.41');
    expect(formatCorrelationShort(0.62)).toBe('.62');
    expect(formatCorrelationShort(1)).toBe('1.00');
    const stats = pairStats(a, b, dates);
    expect(stats.days).toBe(90);
    expect(stats.points).toHaveLength(90);
    expect(stats.correlation).toBeCloseTo(correlation(a.returns, b.returns), 12);
  });

  it('summarises the strongest and weakest pairs', () => {
    expect(summarizeCorrelations(data, defaults)).toMatch(
      /^10 series over 90 days\. Average correlation −?\d\.\d\d\. Highest .+ vs .+ −?\d\.\d\d, lowest .+ vs .+ −?\d\.\d\d\.$/,
    );
  });
});

describe('CorrelationMatrix', () => {
  const render = (config = defaults, onConfigChange = vi.fn()) =>
    renderWithProviders(
      <CorrelationMatrix {...widgetProps(config, data, 460, 420, onConfigChange)} />,
    );

  it('draws an n×n grid with names on the diagonal and numbers in the cells', () => {
    render();
    const grid = screen.getByRole('grid');
    expect(within(grid).getAllByRole('row')).toHaveLength(10);
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(100);
    const { series } = selectSeries(data, defaults);
    const [a, b] = series;
    if (!a || !b) throw new Error('need two series');
    const m = buildMatrix(series);
    const cell = screen.getByRole('gridcell', { name: cellLabel(a, b, m[0]?.[1] ?? 0) });
    expect(cell).toHaveTextContent(formatCorrelation(m[0]?.[1] ?? 0));
    expect(screen.getByRole('gridcell', { name: `${a.label} (${a.name})` })).toHaveTextContent(
      a.label,
    );
  });

  it('moves focus with the arrow keys (one tab stop) and opens the scatter on Enter', () => {
    render();
    const cells = screen.getAllByRole('gridcell');
    expect(cells.filter((c) => c.tabIndex === 0)).toHaveLength(1);
    const start = cells.find((c) => c.tabIndex === 0);
    if (!start) throw new Error('no tab stop');
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowDown' });
    // Row 1, column 1: the diagonal (a name cell), so Enter does nothing there.
    expect(document.activeElement).toBe(cells[11]);
    fireEvent.keyDown(cells[11] as HTMLElement, { key: 'Enter' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(cells[11] as HTMLElement, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cells[12]);
    fireEvent.keyDown(cells[12] as HTMLElement, { key: 'Enter' });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Correlation')).toBeInTheDocument();
    expect(within(dialog).getByTestId('pair-scatter')).toBeInTheDocument();
  });

  it('opens the scatter when a cell is clicked, not on the diagonal', () => {
    render();
    const cells = screen.getAllByRole('gridcell');
    fireEvent.click(cells[0] as HTMLElement);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(cells[2] as HTMLElement);
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/ vs /);
  });

  it('prints a number in every cell at the default 4x4 size', () => {
    renderWithProviders(<CorrelationMatrix {...widgetProps(defaults, data, 460, 220)} />);
    const offDiagonal = screen
      .getAllByRole('gridcell')
      .filter((c) => / vs /.test(c.getAttribute('aria-label') ?? ''));
    expect(offDiagonal.every((c) => /^−?(0?\.\d\d|1\.00)$/.test(c.textContent ?? ''))).toBe(true);
  });

  it('switches subject and lookback through the config', () => {
    const onConfigChange = vi.fn();
    render(defaults, onConfigChange);
    fireEvent.click(screen.getByRole('radio', { name: 'Sectors' }));
    expect(onConfigChange).toHaveBeenCalledWith({ subject: 'sectors' });
    fireEvent.click(screen.getByRole('radio', { name: '252d' }));
    expect(onConfigChange).toHaveBeenCalledWith({ lookback: '252' });
  });

  it('shows sectors at 15 across a year when configured', () => {
    render(configuredConfig);
    const n = Math.min(15, data.sectors.length);
    expect(screen.getAllByRole('row')).toHaveLength(n);
    expect(screen.getByText('· 252 days')).toBeInTheDocument();
  });
});

describeWidgetStates('correlation-matrix', { data: fixtureData, emptyData });
