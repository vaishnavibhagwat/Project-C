import { render, screen } from '@testing-library/react';
import { VirtuosoMockContext } from 'react-virtuoso';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { researchFeedDefinition, summarizeResearch } from '../config';
import ResearchFeed from '../index';
import { filterResearch } from '../model';
import { configuredConfig, fixtureData } from './index';

describe('ResearchFeed', () => {
  const data = fixtureData();
  const defaults = researchFeedDefinition.defaultConfig;

  it('is clearly marked as sample content', () => {
    render(
      <VirtuosoMockContext.Provider value={{ viewportHeight: 600, itemHeight: 90 }}>
        <ResearchFeed {...widgetProps(defaults, data)} />
      </VirtuosoMockContext.Provider>,
    );
    expect(screen.getByText('Sample content')).toBeInTheDocument();
    expect(screen.getAllByText(/Sample note/).length).toBeGreaterThan(0);
  });

  it('filters by sentiment', () => {
    const items = filterResearch(data.items, configuredConfig);
    expect(items.every((i) => i.sentiment === 'Positive')).toBe(true);
  });

  it('orders items newest first with IST timestamps', () => {
    const times = data.items.map((i) => Date.parse(i.publishedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(data.items[0]?.publishedAt).toMatch(/\+05:30$/);
  });

  it('summarises the feed as sample research', () => {
    expect(summarizeResearch(data, defaults)).toMatch(/sample research items/);
  });
});
