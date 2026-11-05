import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { holdingsTreemapDefinition, summarizeTreemap } from '../config';
import HoldingsTreemap from '../index';
import { buildTree, layoutTreemap } from '../model';
import { configuredConfig, emptyData, fixtureData } from './index';

describe('HoldingsTreemap', () => {
  const data = fixtureData();
  const defaults = holdingsTreemapDefinition.defaultConfig;

  it('lays out one tile per equity holding, sized by market value', () => {
    const root = layoutTreemap(buildTree(data, defaults), 800, 400, true);
    const leaves = root.leaves();
    const equity = data.holdings.filter((h) => h.assetClass === 'Equity');
    // 42 NSE stocks plus 6 depositary receipts; bonds, derivatives and funds are not shown.
    expect(leaves).toHaveLength(equity.length);
    expect(equity).toHaveLength(48);
    const area = (n: (typeof leaves)[number]) => (n.x1 - n.x0) * (n.y1 - n.y0);
    const biggest = [...leaves].sort((a, b) => area(b) - area(a))[0];
    const largest = [...equity].sort((a, b) => b.marketValue - a.marketValue)[0];
    expect(biggest?.data.holding?.ticker).toBe(largest?.ticker);
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
    expect(summarizeTreemap(data, defaults)).toMatch(
      /^48 equity holdings\. Largest: [A-Z&-]+ \d+\.\d%/,
    );
  });
});

describeWidgetStates('holdings-treemap', { data: fixtureData, emptyData });
