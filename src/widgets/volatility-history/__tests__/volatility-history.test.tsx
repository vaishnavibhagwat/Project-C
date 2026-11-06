import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { annualisedVolatility } from '@/utils/finance';
import { volatilityHistoryDefinition } from '../config';
import VolatilityHistory from '../index';
import { rollingVolatility, volSummary } from '../model';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = volatilityHistoryDefinition.defaultConfig;

describe('VolatilityHistory', () => {
  it('matches finance.annualisedVolatility on the last window', () => {
    const points = rollingVolatility(data, defaults);
    const navs = data.points.map((p) => p.nav);
    const returns = navs.slice(1).map((v, i) => v / (navs[i] ?? v) - 1);
    const expected = annualisedVolatility(returns.slice(-63)) * 100;
    expect(points.at(-1)?.fund).toBeCloseTo(expected, 6);
    expect(points.length).toBeLessThanOrEqual(756);
  });

  it('covers the chosen range and window', () => {
    expect(rollingVolatility(data, configuredConfig).length).toBe(252);
    expect(volSummary(rollingVolatility(data, defaults), defaults)).toMatch(
      /^63-day rolling volatility \(annualised\): fund \d+\.\d%, Nifty 50 \d+\.\d%\. Over 3Y the fund ranged \d+\.\d% to \d+\.\d%\.$/,
    );
  });

  it('switches window and range through the config', () => {
    const onConfigChange = vi.fn();
    renderWithProviders(
      <VolatilityHistory {...widgetProps(defaults, data, 600, 300, onConfigChange)} />,
    );
    fireEvent.click(screen.getByRole('radio', { name: '21d' }));
    expect(onConfigChange).toHaveBeenCalledWith({ window: '21' });
    fireEvent.click(screen.getByRole('radio', { name: '5Y' }));
    expect(onConfigChange).toHaveBeenCalledWith({ range: '5Y' });
  });
});

describeWidgetStates('volatility-history', { data: fixtureData, emptyData });
