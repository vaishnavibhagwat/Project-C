import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { useWidgetStore } from '@/store/widgetStore';
import { navPerformanceDefinition, summarizeNav } from '../config';
import NavPerformance from '../index';
import { buildNavSeries } from '../model';
import { configuredConfig, fixtureData } from './index';

describe('NavPerformance', () => {
  const data = fixtureData();
  const defaults = navPerformanceDefinition.defaultConfig;

  it('rebases both series to 100 at the start of the range', () => {
    const s = buildNavSeries(data, defaults);
    expect(s.points[0]?.portfolio).toBeCloseTo(100, 8);
    expect(s.points[0]?.benchmark).toBeCloseTo(100, 8);
    expect(s.points).toHaveLength(253);
  });

  it('keeps NAV units in nav mode and covers the full history for 5Y', () => {
    const s = buildNavSeries(data, configuredConfig);
    expect(s.points[0]?.portfolio).toBeCloseTo(data.points[0]?.nav ?? 0, 8);
    expect(s.points.length).toBe(data.points.length);
  });

  it('shows fund and benchmark returns for the range', () => {
    render(<NavPerformance {...widgetProps(defaults, data)} />);
    expect(screen.getByText('Fund')).toBeInTheDocument();
    expect(screen.getByText('Nifty 50')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '1Y' })).toHaveAttribute('aria-checked', 'true');
  });

  it('persists the selected range to the widget config', () => {
    const id = 'workstation-nav-performance';
    render(<NavPerformance {...widgetProps(defaults, data)} instanceId={id} />);
    fireEvent.click(screen.getByRole('radio', { name: '3Y' }));
    expect(useWidgetStore.getState().instances[id]?.config.range).toBe('3Y');
  });

  it('summarises active return', () => {
    expect(summarizeNav(data, defaults)).toMatch(/Active return [+−]\d/);
  });
});
