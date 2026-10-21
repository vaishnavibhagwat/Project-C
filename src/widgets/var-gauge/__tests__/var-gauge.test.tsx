import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { summarizeVar, varGaugeDefinition } from '../config';
import VarGauge from '../index';
import { selectVar } from '../model';
import { configuredConfig, fixtureData } from './index';

describe('VarGauge', () => {
  const data = fixtureData();
  const defaults = varGaugeDefinition.defaultConfig;

  it('selects the configured method and confidence', () => {
    expect(selectVar(data, defaults).value).toBe(data.historical.var99);
    expect(selectVar(data, configuredConfig).value).toBe(data.parametric.var95);
    expect(selectVar(data, configuredConfig).cvar).toBeNull();
  });

  it('classifies limit utilisation', () => {
    const v = data.historical.var99 * 100;
    expect(selectVar(data, { ...defaults, limitPct: v * 2 }).status).toBe('within');
    expect(selectVar(data, { ...defaults, limitPct: v * 1.1 }).status).toBe('near');
    expect(selectVar(data, { ...defaults, limitPct: v * 0.9 }).status).toBe('breach');
  });

  it('shows both methods side by side with a text status', () => {
    render(<VarGauge {...widgetProps({ ...defaults, limitPct: 0.5 }, data, 400, 500)} />);
    expect(screen.getByText(/Limit breach/)).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Historical' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Parametric' })).toBeInTheDocument();
  });

  it('documents its assumptions', () => {
    expect(data.assumptions.join(' ')).toMatch(/252/);
    expect(summarizeVar(data, defaults)).toMatch(/99% 1-day historical VaR is \d+\.\d{2}% of AUM/);
  });
});
