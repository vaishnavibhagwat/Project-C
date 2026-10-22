import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { sectorAttributionDefinition, summarizeAttribution } from '../config';
import SectorAttribution from '../index';
import { configuredConfig, fixtureData } from './index';

describe('SectorAttribution', () => {
  const data = fixtureData();
  const defaults = sectorAttributionDefinition.defaultConfig;

  it('splits each sector into allocation + selection = total', () => {
    for (const p of data.periods) {
      for (const r of p.rows) expect(r.allocationPct + r.selectionPct).toBeCloseTo(r.totalPct, 3);
    }
  });

  it('documents the simplified methodology', () => {
    expect(data.methodology).toMatch(/Brinson-Fachler/);
    expect(data.methodology).toMatch(/Simplification/);
  });

  it('shows the detail table on wide layouts', () => {
    render(<SectorAttribution {...widgetProps(configuredConfig, data, 1200, 400)} />);
    expect(screen.getByRole('table', { name: /Attribution by sector, 1Y/ })).toBeInTheDocument();
  });

  it('shows active return in basis points (portfolio minus benchmark)', () => {
    render(<SectorAttribution {...widgetProps(defaults, data)} />);
    const p = data.periods.find((x) => x.period === defaults.period);
    if (!p) throw new Error('period missing');
    const bp = Math.round((p.portfolioReturnPct - p.benchmarkReturnPct) * 100);
    const sign = bp >= 0 ? '+' : '−';
    const active = screen.getByText('Active').nextElementSibling;
    expect(active).toHaveTextContent(`${sign}${Math.abs(bp)} bp`);
  });

  it('changes period from the in-widget toggle', () => {
    const onConfigChange = vi.fn();
    render(<SectorAttribution {...widgetProps(defaults, data, 800, 400, onConfigChange)} />);
    fireEvent.click(screen.getByRole('radio', { name: '6M' }));
    expect(onConfigChange).toHaveBeenCalledWith({ period: '6M' });
  });

  it('summarises contributors and detractors', () => {
    expect(summarizeAttribution(data, defaults)).toMatch(
      /Largest contributor .+ largest detractor/,
    );
  });
});
