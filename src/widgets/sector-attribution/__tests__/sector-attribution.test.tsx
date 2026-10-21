import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { useWidgetStore } from '@/store/widgetStore';
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

  it('changes period from the in-widget toggle', () => {
    const id = 'performance-sector-attribution';
    render(<SectorAttribution {...widgetProps(defaults, data)} instanceId={id} />);
    fireEvent.click(screen.getByRole('radio', { name: '6M' }));
    expect(useWidgetStore.getState().instances[id]?.config.period).toBe('6M');
  });

  it('summarises contributors and detractors', () => {
    expect(summarizeAttribution(data, defaults)).toMatch(
      /Largest contributor .+ largest detractor/,
    );
  });
});
