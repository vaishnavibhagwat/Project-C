import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { VAR_HISTORY_DAYS } from '@/data/derive/risk';
import { summarizeVar, varGaugeDefinition } from '../config';
import { arcPath, NEEDLE_SPRING, needleAngle } from '../Gauge';
import VarGauge from '../index';
import { gaugeMax, rangeFor, selectVar, statusLabel, zoneFor } from '../model';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = varGaugeDefinition.defaultConfig;

describe('VaR data', () => {
  it('defaults to 99% 1-day historical VaR over a 252-day lookback', () => {
    expect(defaults.confidence).toBe('99');
    expect(data.horizonDays).toBe(1);
    expect(data.lookbackDays).toBe(252);
    expect(selectVar(data, defaults).value).toBe(data.historical.var99);
    expect(selectVar(data, configuredConfig).value).toBe(data.parametric.var95);
  });

  it('carries 30 days of rolling VaR, ending with today’s figures', () => {
    expect(data.history).toHaveLength(VAR_HISTORY_DAYS);
    const dates = data.history.map((h) => h.date);
    expect(dates).toEqual([...dates].sort());
    const today = data.history.at(-1);
    expect(today?.historical.var99).toBeCloseTo(data.historical.var99, 6);
    expect(today?.parametric.var95).toBeCloseTo(data.parametric.var95, 6);
    for (const h of data.history) {
      // Parametric 99% is always further in the tail than parametric 95%.
      expect(h.parametric.var99).toBeGreaterThan(h.parametric.var95);
    }
  });
});

describe('VarGauge model', () => {
  it('uses green below 70% of the limit, amber 70–90%, red above 90%', () => {
    expect(zoneFor(0.69)).toBe('within');
    expect(zoneFor(0.7)).toBe('near');
    expect(zoneFor(0.9)).toBe('near');
    expect(zoneFor(0.901)).toBe('breach');
    const v = data.historical.var99 * 100;
    const over = selectVar(data, { ...defaults, limitPct: v * 0.95 });
    expect(over.overLimit).toBe(true);
    expect(statusLabel(over)).toBe('Limit breached');
    expect(statusLabel(selectVar(data, { ...defaults, limitPct: v / 0.95 }))).toBe('Near limit');
    expect(statusLabel(selectVar(data, { ...defaults, limitPct: v / 0.8 }))).toBe(
      'Approaching limit',
    );
  });

  it('gives a 30-day range around today’s value and a dial that fits all of it', () => {
    const reading = selectVar(data, defaults);
    const range = rangeFor(data, defaults);
    if (!range) throw new Error('no range');
    expect(range.min).toBeLessThanOrEqual(reading.value);
    expect(range.max).toBeGreaterThanOrEqual(reading.value);
    const max = gaugeMax(reading, range);
    expect(max).toBeGreaterThanOrEqual(reading.limit * 1.25);
    expect(max).toBeGreaterThan(range.max);
  });

  it('maps values onto a 180° dial and draws ring segments', () => {
    expect(needleAngle(0, 2)).toBe(-90);
    expect(needleAngle(1, 2)).toBe(0);
    expect(needleAngle(2, 2)).toBe(90);
    expect(needleAngle(5, 2)).toBe(90);
    expect(arcPath(40, 50, -90, 0)).toMatch(
      /^M-50\.00,-?0\.00 A50\.00,50\.00 0 0 1 0\.00,-50\.00 L/,
    );
    expect(arcPath(40, 50, 10, 10)).toBe('');
    expect(NEEDLE_SPRING.type).toBe('spring');
  });

  it('summarises value, limit use and the range', () => {
    expect(summarizeVar(data, defaults)).toMatch(
      /^99% 1-day historical VaR is \d+\.\d{2}% of AUM, about ₹[\d,]+ Cr\. .+: \d+% of the 2% limit\. 30-day range \d+\.\d{2}% to \d+\.\d{2}%\.$/,
    );
  });
});

describe('VarGauge', () => {
  it('draws three zones, the 30-day band, the limit tick and the needle', () => {
    renderWithProviders(<VarGauge {...widgetProps(defaults, data, 240, 140)} />);
    const dial = screen.getByTestId('var-dial');
    expect(
      [...dial.querySelectorAll('[data-zone]')].map((p) => p.getAttribute('data-zone')),
    ).toEqual(['green', 'amber', 'red']);
    expect(screen.getByTestId('var-range-band').getAttribute('d')).toMatch(/^M/);
    expect(screen.getByTestId('var-limit-tick')).toBeInTheDocument();
    expect(screen.getByTestId('var-needle')).toBeInTheDocument();
  });

  it('shows VaR in INR and as % of the limit in text, compact at 2x2', () => {
    // About the body of a 2x2 widget: the detail line is kept for screen readers only.
    renderWithProviders(<VarGauge {...widgetProps(defaults, data, 200, 92)} />);
    const r = selectVar(data, defaults);
    expect(screen.getByText(/^₹[\d,]+ Cr$/)).toBeInTheDocument();
    expect(screen.getByText(`${Math.round(r.utilisation * 100)}% of limit`)).toBeInTheDocument();
    expect(screen.getByText(/of AUM · 99% 1-day · historical · 30d range/)).toHaveClass('sr-only');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('switches confidence and method from the toggles', () => {
    const onConfigChange = vi.fn();
    renderWithProviders(<VarGauge {...widgetProps(defaults, data, 240, 140, onConfigChange)} />);
    fireEvent.click(screen.getByRole('radio', { name: '95%' }));
    expect(onConfigChange).toHaveBeenCalledWith({ confidence: '95' });
    fireEvent.click(screen.getByRole('radio', { name: 'Param' }));
    expect(onConfigChange).toHaveBeenCalledWith({ method: 'parametric' });
  });

  it('adds the status, both methods and CVaR when there is room', () => {
    renderWithProviders(
      <VarGauge {...widgetProps({ ...defaults, limitPct: 0.5 }, data, 400, 500)} />,
    );
    expect(screen.getByText(/Limit breached/)).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Historical' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Parametric' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'CVaR (hist.)' })).toBeInTheDocument();
  });
});

describeWidgetStates('var-gauge', { data: fixtureData, emptyData });
