import { render, screen } from '@testing-library/react';
import { VirtuosoMockContext } from 'react-virtuoso';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { NIFTY50 } from '@/data/nifty50';
import { researchFeedDefinition, summarizeResearch } from '../config';
import ResearchFeed from '../index';
import { filterArticles } from '../model';
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
    expect(screen.getAllByText(/\(sample\)$/).length).toBeGreaterThan(0);
  });

  it('returns NewsArticle objects with scores in -1..1 that match their sentiment', () => {
    const tickers = new Set(NIFTY50.map((c) => c.symbol));
    for (const a of data.articles) {
      expect(a.sentimentScore).toBeGreaterThanOrEqual(-1);
      expect(a.sentimentScore).toBeLessThanOrEqual(1);
      if (a.sentiment === 'positive') expect(a.sentimentScore).toBeGreaterThan(0);
      if (a.sentiment === 'negative') expect(a.sentimentScore).toBeLessThan(0);
      for (const t of a.relevantTickers) expect(tickers.has(t)).toBe(true);
    }
  });

  it('filters by sentiment', () => {
    const articles = filterArticles(data.articles, configuredConfig);
    expect(articles.length).toBeGreaterThan(0);
    expect(articles.every((a) => a.sentiment === 'positive')).toBe(true);
  });

  it('orders articles newest first with IST timestamps', () => {
    const times = data.articles.map((a) => Date.parse(a.publishedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(data.articles[0]?.publishedAt).toMatch(/\+05:30$/);
  });

  it('summarises the feed as sample research', () => {
    expect(summarizeResearch(data, defaults)).toMatch(/sample research articles/);
  });
});
