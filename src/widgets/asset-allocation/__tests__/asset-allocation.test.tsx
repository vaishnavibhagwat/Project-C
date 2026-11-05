import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { assetAllocationDefinition, summarizeAllocation } from '../config';
import AssetAllocation from '../index';
import { buildSlices, MAX_SECTOR_SLICES } from '../model';
import { configuredConfig, emptyData, fixtureData } from './index';

describe('AssetAllocation', () => {
  const data = fixtureData();
  const defaults = assetAllocationDefinition.defaultConfig;

  it('lists four asset classes whose weights sum to 100%', () => {
    const slices = buildSlices(data, defaults);
    expect(slices.map((s) => s.key)).toEqual([
      'equity',
      'fixed-income',
      'derivatives',
      'alternatives',
    ]);
    expect(slices.reduce((s, x) => s + x.weightPct, 0)).toBeCloseTo(100, 6);
  });

  it('breaks the fund down by geography, India first, summing to 100%', () => {
    const slices = buildSlices(data, { ...defaults, view: 'geography' });
    expect(slices.map((s) => s.key)).toEqual(['India', 'US', 'UK', 'Singapore']);
    expect(slices[0]?.weightPct).toBeGreaterThan(80);
    expect(slices.reduce((s, x) => s + x.weightPct, 0)).toBeCloseTo(100, 6);
  });

  it('groups sector tails into "Other" while still summing to 100%', () => {
    const slices = buildSlices(data, configuredConfig);
    expect(slices.length).toBeLessThanOrEqual(MAX_SECTOR_SLICES);
    expect(slices.at(-1)?.label).toMatch(/^Other \(\d+ sectors\)$/);
    expect(slices.reduce((s, x) => s + x.weightPct, 0)).toBeCloseTo(100, 6);
  });

  it('renders an accessible legend table', () => {
    render(<AssetAllocation {...widgetProps(defaults, data)} />);
    const table = screen.getByRole('table', { name: 'Allocation breakdown' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getByText('Fixed Income')).toBeInTheDocument();
  });

  it('switches breakdown from the in-widget toggle', () => {
    const onConfigChange = vi.fn();
    render(<AssetAllocation {...widgetProps(defaults, data, 800, 400, onConfigChange)} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Sector' }));
    expect(onConfigChange).toHaveBeenCalledWith({ view: 'sector' });
  });

  it('summarises weights', () => {
    expect(summarizeAllocation(data, defaults)).toMatch(/Equity \d+\.\d%/);
  });
});

describeWidgetStates('asset-allocation', { data: fixtureData, emptyData });
