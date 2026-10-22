import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { assetAllocationDefinition, summarizeAllocation } from '../config';
import AssetAllocation from '../index';
import { buildSlices, MAX_SECTOR_SLICES } from '../model';
import { configuredConfig, fixtureData } from './index';

describe('AssetAllocation', () => {
  const data = fixtureData();
  const defaults = assetAllocationDefinition.defaultConfig;

  it('lists five asset classes whose weights sum to 100%', () => {
    const slices = buildSlices(data, defaults);
    expect(slices.map((s) => s.key)).toEqual(['equity', 'debt', 'gold', 'reits', 'cash']);
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
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(within(table).getByText('Fixed Income')).toBeInTheDocument();
  });

  it('switches breakdown from the in-widget toggle', () => {
    const onConfigChange = vi.fn();
    render(<AssetAllocation {...widgetProps(defaults, data, 800, 400, onConfigChange)} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Sector' }));
    expect(onConfigChange).toHaveBeenCalledWith({ view: 'sector' });
  });

  it('summarises weights', () => {
    expect(summarizeAllocation(data, defaults)).toMatch(/Indian Equity \d+\.\d%/);
  });
});
