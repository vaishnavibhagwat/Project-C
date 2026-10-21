import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { drawdownDefinition, summarizeDrawdown } from '../config';
import Drawdown from '../index';
import { buildDrawdown } from '../model';
import { configuredConfig, fixtureData } from './index';

describe('Drawdown', () => {
  const data = fixtureData();
  const defaults = drawdownDefinition.defaultConfig;

  it('finds the ~30-40% drawdown event over the full history', () => {
    const m = buildDrawdown(data, defaults);
    expect(m.maxDepth).toBeGreaterThanOrEqual(0.3);
    expect(m.maxDepth).toBeLessThanOrEqual(0.4);
    expect(m.points.every((p) => p.fund <= 0)).toBe(true);
    expect(m.peakDate && m.troughDate && m.peakDate < m.troughDate).toBe(true);
  });

  it('measures drawdown within the selected window only', () => {
    expect(buildDrawdown(data, configuredConfig).maxDepth).toBeLessThan(
      buildDrawdown(data, defaults).maxDepth,
    );
  });

  it('shows the max drawdown with a down arrow, not colour alone', () => {
    render(<Drawdown {...widgetProps(defaults, data)} />);
    expect(screen.getByText(/^▼ \d+\.\d%$/)).toBeInTheDocument();
  });

  it('summarises depth and dates', () => {
    expect(summarizeDrawdown(data, defaults)).toMatch(
      /Worst drawdown over 5Y: \d+\.\d% from .+ to .+/,
    );
  });
});
