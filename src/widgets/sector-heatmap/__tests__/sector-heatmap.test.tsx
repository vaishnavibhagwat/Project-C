import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { sectorHeatmapDefinition, summarizeHeatmap } from '../config';
import SectorHeatmap from '../index';
import { buildHeatModel } from '../model';
import { configuredConfig, fixtureData } from './index';

describe('SectorHeatmap', () => {
  const data = fixtureData();
  const defaults = sectorHeatmapDefinition.defaultConfig;

  it('keeps the trailing N sessions plus the live column', () => {
    const m = buildHeatModel(data, defaults);
    const live = data.columns.some((c) => c.intraday) ? 1 : 0;
    expect(m.columns).toHaveLength(10 + live);
    expect(m.rows).toHaveLength(data.sectors.length);
  });

  it('sorts rows by name when configured', () => {
    const names = buildHeatModel(data, configuredConfig).rows.map((r) => r.sector);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('provides a text table equivalent for screen readers', () => {
    render(<SectorHeatmap {...widgetProps(defaults, data)} />);
    const table = screen.getByRole('table', { name: /Sector returns by session/ });
    expect(within(table).getAllByRole('rowheader')).toHaveLength(data.sectors.length);
    expect(screen.getByRole('img', { name: /Sector returns heat map/ })).toBeInTheDocument();
  });

  it('summarises the best and weakest sectors', () => {
    expect(summarizeHeatmap(data, defaults)).toMatch(/best sector .+ weakest .+/);
  });
});
