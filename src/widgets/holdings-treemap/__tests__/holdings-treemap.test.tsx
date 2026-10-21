import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { holdingsTreemapDefinition, summarizeTreemap } from '../config';
import HoldingsTreemap from '../index';
import { buildTree, layoutTreemap } from '../model';
import { configuredConfig, fixtureData } from './index';

describe('HoldingsTreemap', () => {
  const data = fixtureData();
  const defaults = holdingsTreemapDefinition.defaultConfig;

  it('lays out one tile per holding, sized by market value', () => {
    const root = layoutTreemap(buildTree(data, defaults), 800, 400, true);
    const leaves = root.leaves();
    expect(leaves).toHaveLength(data.holdings.length);
    const area = (n: (typeof leaves)[number]) => (n.x1 - n.x0) * (n.y1 - n.y0);
    const biggest = [...leaves].sort((a, b) => area(b) - area(a))[0];
    const largest = [...data.holdings].sort((a, b) => b.marketValueInr - a.marketValueInr)[0];
    expect(biggest?.data.holding?.symbol).toBe(largest?.symbol);
  });

  it('groups by sector unless configured flat', () => {
    expect(buildTree(data, defaults).children?.every((c) => c.children)).toBe(true);
    expect(buildTree(data, configuredConfig).children?.every((c) => c.holding)).toBe(true);
  });

  it('renders an SVG with an accessible name', () => {
    render(<HoldingsTreemap {...widgetProps(defaults, data)} />);
    expect(screen.getByRole('img', { name: /Holdings treemap/ })).toBeInTheDocument();
  });

  it('summarises the largest positions', () => {
    expect(summarizeTreemap(data, defaults)).toMatch(/^42 holdings\. Largest: [A-Z&-]+ \d+\.\d%/);
  });
});
