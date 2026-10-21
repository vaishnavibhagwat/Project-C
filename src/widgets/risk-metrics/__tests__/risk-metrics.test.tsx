import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { formatRatio } from '@/utils/format';
import { riskMetricsDefinition, summarizeMetrics } from '../config';
import RiskMetrics from '../index';
import { buildTiles } from '../model';
import { configuredConfig, fixtureData } from './index';

describe('RiskMetrics', () => {
  const data = fixtureData();
  const defaults = riskMetricsDefinition.defaultConfig;

  it('reports a Sharpe ratio within the 0.3-2.5 band using a 6.5-7% risk-free rate', () => {
    expect(data.sharpe).toBeGreaterThanOrEqual(0.3);
    expect(data.sharpe).toBeLessThanOrEqual(2.5);
    expect(data.riskFreeRate).toBeGreaterThanOrEqual(0.065);
    expect(data.riskFreeRate).toBeLessThanOrEqual(0.07);
  });

  it('switches Sharpe to the trailing year when configured', () => {
    const full = buildTiles(data, defaults).find((t) => t.key === 'sharpe');
    const year = buildTiles(data, configuredConfig).find((t) => t.key === 'sharpe');
    expect(full?.value).toBe(formatRatio(data.sharpe));
    expect(year?.value).toBe(formatRatio(data.oneYear.sharpe));
  });

  it('renders every tile with a definition tooltip', () => {
    render(<RiskMetrics {...widgetProps(defaults, data)} />);
    expect(screen.getByText('Sharpe ratio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Sharpe ratio' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^About / })).toHaveLength(10);
  });

  it('summarises the headline metrics', () => {
    expect(summarizeMetrics(data, defaults)).toMatch(/^Sharpe ratio \d\.\d{2}\./);
  });
});
