import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { sectorHeatMapDefinition, summarizeSectorHeatMap } from '../config';
import SectorHeatMap, { fitLabel } from '../index';
import { layoutCells } from '../layout';
import {
  cellFill,
  directionMark,
  holdingCells,
  pnlPercent,
  scopedHoldings,
  sectorCells,
} from '../model';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = sectorHeatMapDefinition.defaultConfig;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('SectorHeatMap model', () => {
  const equity = scopedHoldings(data, defaults);
  const sectors = sectorCells(equity);

  it('aggregates equity holdings by sector: value, P&L and count add up', () => {
    expect(equity.every((h) => h.assetClass === 'Equity')).toBe(true);
    expect(sum(sectors.map((s) => s.marketValueInr))).toBeCloseTo(
      sum(equity.map((h) => h.marketValue)),
      2,
    );
    expect(sum(sectors.map((s) => s.pnlInr))).toBeCloseTo(sum(equity.map((h) => h.dailyPnL)), 2);
    expect(sum(sectors.map((s) => s.holdingsCount))).toBe(equity.length);
  });

  it('measures P&L % against the previous close value', () => {
    expect(pnlPercent(102, 2)).toBeCloseTo(2, 10);
    expect(pnlPercent(98, -2)).toBeCloseTo(-2, 10);
    const s = sectors[0];
    if (!s) throw new Error('no sectors');
    expect(s.pnlPct).toBeCloseTo((s.pnlInr / (s.marketValueInr - s.pnlInr)) * 100, 10);
  });

  it('whole-book scope groups non-equity by asset class', () => {
    const labels = sectorCells(scopedHoldings(data, configuredConfig)).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['Fixed Income', 'Alternatives']));
  });

  it('zooms into the holdings of one sector', () => {
    const s = sectors[0];
    if (!s) throw new Error('no sectors');
    const cells = holdingCells(equity, s.key);
    expect(cells).toHaveLength(s.holdingsCount);
    expect(sum(cells.map((c) => c.marketValueInr))).toBeCloseTo(s.marketValueInr, 2);
  });

  it('lays out a squarified treemap inside the box, larger value = larger area', () => {
    const placed = layoutCells(sectors, 400, 300);
    expect(placed).toHaveLength(sectors.length);
    for (const c of placed) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(400);
      expect(c.y + c.h).toBeLessThanOrEqual(300);
    }
    const [a, b] = [...placed].sort((p, q) => q.marketValueInr - p.marketValueInr);
    if (!a || !b) throw new Error('need two cells');
    expect(a.w * a.h).toBeGreaterThanOrEqual(b.w * b.h);
  });

  it('colours with theme variables on both scales, stronger for larger moves', () => {
    const green = cellFill(1.5, defaults);
    const red = cellFill(-0.3, defaults);
    expect(green.fill).toBe('rgb(var(--color-positive))');
    expect(red.fill).toBe('rgb(var(--color-negative))');
    expect(green.opacity).toBeGreaterThan(red.opacity);
    expect(cellFill(5, defaults).opacity).toBeCloseTo(0.9, 10);
    expect(cellFill(1, configuredConfig).fill).toBe('rgb(var(--color-chart-5))');
    expect(cellFill(-1, configuredConfig).fill).toBe('rgb(var(--color-chart-3))');
  });

  it('shortens cell names to fit, or drops them when too narrow', () => {
    expect(fitLabel('FMCG', 100)).toBe('FMCG');
    expect(fitLabel('Information Technology', 66)).toBe('Informati…');
    expect(fitLabel('Information Technology', 20)).toBeNull();
  });

  it('marks direction with a sign as well as colour', () => {
    expect([directionMark(0.4), directionMark(-0.4), directionMark(0)]).toEqual(['▲', '▼', '■']);
  });

  it('summarises best and worst sectors', () => {
    expect(summarizeSectorHeatMap(data, defaults)).toMatch(
      /^Sectors by day P&L\. \d+ of \d+ up today\. Best .+ [+−-]\d+\.\d\d%, worst .+ [+−-]\d+\.\d\d%\.$/,
    );
  });
});

describe('SectorHeatMap', () => {
  const sectorButtons = () => screen.getAllByRole('button', { name: /Show holdings\.$/ });

  it('draws one focusable cell per sector, each with a sign', () => {
    render(<SectorHeatMap {...widgetProps(defaults, data, 600, 400)} />);
    const sectors = sectorCells(scopedHoldings(data, defaults));
    expect(sectorButtons()).toHaveLength(sectors.length);
    const svg = screen.getByRole('group', { name: /^Sectors sized by market value/ });
    expect(svg.textContent).toMatch(/[▲▼■]/);
  });

  it('shows the tooltip with value, P&L amount, P&L % and holdings count', () => {
    render(<SectorHeatMap {...widgetProps(defaults, data, 600, 400)} />);
    const [first] = sectorButtons();
    if (!first) throw new Error('no cells');
    fireEvent.mouseEnter(first);
    const tip = screen.getByRole('tooltip');
    for (const label of ['Market value', 'Day P&L', 'Day P&L %', 'Holdings']) {
      expect(within(tip).getByText(label)).toBeInTheDocument();
    }
    expect(within(tip).getAllByText(/₹/).length).toBeGreaterThanOrEqual(2);
  });

  it('zooms into a sector with click or Enter, and Back returns', () => {
    render(<SectorHeatMap {...widgetProps(defaults, data, 600, 400)} />);
    const sector = sectorCells(scopedHoldings(data, defaults)).sort(
      (a, b) => b.marketValueInr - a.marketValueInr,
    )[0];
    if (!sector) throw new Error('no sectors');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${escape(sector.name)}:`) }));
    const nav = screen.getByRole('navigation', { name: 'Heat map level' });
    expect(nav).toHaveTextContent(sector.label);
    expect(screen.getAllByRole('img', { name: /1 holding\.$/ })).toHaveLength(sector.holdingsCount);
    fireEvent.click(within(nav).getByRole('button', { name: 'Back' }));
    expect(sectorButtons().length).toBeGreaterThan(1);

    const [cell] = sectorButtons();
    if (!cell) throw new Error('no cells');
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(screen.getByRole('navigation', { name: 'Heat map level' })).toBeInTheDocument();
  });

  it('shows the blue / orange scale in the legend when configured', () => {
    const { container } = render(
      <SectorHeatMap {...widgetProps(configuredConfig, data, 600, 400)} />,
    );
    const gradient = container.querySelector('span[style*="linear-gradient"]');
    expect(gradient?.getAttribute('style')).toContain('--color-chart-5');
    expect(gradient?.getAttribute('style')).toContain('--color-chart-3');
  });
});

describeWidgetStates('sector-heat-map', { data: fixtureData, emptyData });
