import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { exposureBreakdownDefinition } from '../config';
import ExposureBreakdown from '../index';
import { exposureRows, exposureSummary, grossNet } from '../model';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = exposureBreakdownDefinition.defaultConfig;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe('ExposureBreakdown', () => {
  it('groups market value to 100% of NAV; derivatives add exposure beyond their value', () => {
    const rows = exposureRows(data, defaults);
    expect(sum(rows.map((r) => r.marketValuePct))).toBeCloseTo(100, 6);
    const deriv = rows.find((r) => r.key === 'Derivatives');
    expect(Math.abs(deriv?.exposurePct ?? 0)).toBeGreaterThan(Math.abs(deriv?.marketValuePct ?? 0));
    const { gross, net } = grossNet(data);
    expect(gross).toBeGreaterThanOrEqual(Math.abs(net));
    expect(gross).toBeGreaterThan(100);
  });

  it('groups by currency when configured', () => {
    expect(
      exposureRows(data, configuredConfig)
        .map((r) => r.key)
        .sort(),
    ).toEqual(['INR', 'USD']);
    expect(exposureSummary(data, defaults)).toMatch(
      /^Gross exposure \d+\.\d% and net -?\d+\.\d% of NAV\. Largest asset class: .+$/,
    );
  });

  it('shows gross and net and switches the grouping', () => {
    const onConfigChange = vi.fn();
    renderWithProviders(
      <ExposureBreakdown {...widgetProps(defaults, data, 500, 300, onConfigChange)} />,
    );
    expect(screen.getByText('Gross')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Sector' }));
    expect(onConfigChange).toHaveBeenCalledWith({ dimension: 'sector' });
  });
});

describeWidgetStates('exposure-breakdown', { data: fixtureData, emptyData });
