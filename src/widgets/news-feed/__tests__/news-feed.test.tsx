import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_TIME, fixture } from '@/__tests__/fixtures';
import { renderWithProviders, widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { MARKET_NEWS_LIMIT } from '@/data/derive/news';
import { NEWS_SOURCES } from '@/data/mock/news';
import { WIRE_GAP_SECONDS } from '@/data/mock/wire';
import { publishWidgetEvent } from '@/utils/widgetEvents';
import { newsFeedDefinition, summarizeNewsFeed } from '../config';
import NewsFeed from '../index';
import { filterArticles, mergeArticles } from '../model';
import type { FeedArticle, NewsFeedConfig } from '../types';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = newsFeedDefinition.defaultConfig;
const withConfig = (patch: Partial<NewsFeedConfig>) => ({ ...defaults, ...patch });

describe('market/news endpoint', () => {
  it('serves simulated stories up to "now", newest first, from the four outlet labels', () => {
    expect(data.articles.length).toBeGreaterThan(20);
    expect(data.articles.length).toBeLessThanOrEqual(MARKET_NEWS_LIMIT);
    const times = data.articles.map((a) => Date.parse(a.publishedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(Math.max(...times)).toBeLessThanOrEqual(FIXTURE_TIME);
    for (const a of data.articles) {
      expect(NEWS_SOURCES).toContain(a.source);
      expect(a.summary).toMatch(/^Simulated story:/);
    }
    expect(data.sources).toEqual([...NEWS_SOURCES]);
  });

  it('adds wire stories every 1–4 minutes, identical on every derivation', () => {
    const wire = data.articles.filter((a) => a.articleId.startsWith('wire-'));
    expect(wire.length).toBeGreaterThan(10);
    const times = wire.map((a) => Date.parse(a.publishedAt));
    for (let i = 1; i < times.length; i += 1) {
      const gap = ((times[i - 1] ?? 0) - (times[i] ?? 0)) / 1000;
      if (gap > WIRE_GAP_SECONDS[1] * 2) continue; // midnight boundary between two days
      expect(gap).toBeGreaterThanOrEqual(WIRE_GAP_SECONDS[0] - 1);
      expect(gap).toBeLessThanOrEqual(WIRE_GAP_SECONDS[1] + 1);
    }
    expect(fixture('market/news')).toEqual(data);
  });

  it('publishes a new story a few minutes later', () => {
    const later = fixture('market/news', FIXTURE_TIME + 5 * 60_000);
    const known = new Set(data.articles.map((a) => a.articleId));
    expect(later.articles.filter((a) => !known.has(a.articleId)).length).toBeGreaterThan(0);
  });
});

describe('NewsFeed model', () => {
  const article = (id: string, at: string, patch: Partial<FeedArticle> = {}): FeedArticle => ({
    articleId: id,
    headline: `Headline ${id}`,
    summary: 'Simulated story: test.',
    source: 'Reuters',
    publishedAt: at,
    sentiment: 'neutral',
    sentimentScore: 0,
    relevantTickers: [],
    category: 'macro',
    ...patch,
  });

  it('merges streamed stories in, newest first, without duplicates or in-house research', () => {
    const polled = [article('a', '2026-10-20T10:00:00+05:30')];
    const streamed = [
      article('b', '2026-10-20T10:05:00+05:30'),
      article('a', '2026-10-20T10:00:00+05:30'),
      article('r', '2026-10-20T10:06:00+05:30', { source: 'Meridian Research · A. Mehta' }),
    ];
    expect(mergeArticles(polled, streamed, NEWS_SOURCES).map((a) => a.articleId)).toEqual([
      'b',
      'a',
    ]);
  });

  it('filters by source, every keyword, selected symbol and limit', () => {
    const reuters = filterArticles(data.articles, withConfig({ source: 'Reuters' }), null);
    expect(reuters.every((a) => a.source === 'Reuters')).toBe(true);
    const words = filterArticles(data.articles, withConfig({ keyword: 'simulated story' }), null);
    expect(words.length).toBe(Math.min(40, data.articles.length));
    const ticker = data.articles.find((a) => a.relevantTickers.length > 0)?.relevantTickers[0];
    if (!ticker) throw new Error('no tickers in fixture');
    const bySymbol = filterArticles(data.articles, defaults, ticker);
    expect(bySymbol.length).toBeGreaterThan(0);
    expect(bySymbol.every((a) => a.relevantTickers.includes(ticker))).toBe(true);
    expect(filterArticles(data.articles, withConfig({ limit: '20' }), null)).toHaveLength(20);
    expect(filterArticles(data.articles, withConfig({ keyword: 'zzqx' }), null)).toEqual([]);
  });

  it('summarises counts by sentiment and the latest story', () => {
    expect(summarizeNewsFeed(data, defaults)).toMatch(
      /^\d+ simulated articles: \d+ positive, \d+ negative, \d+ neutral\. Latest: .+ \((Reuters|Bloomberg|Economic Times|Moneycontrol), (positive|negative|neutral)\)\.$/,
    );
  });
});

describe('NewsFeed', () => {
  const list = () => screen.getByRole('list', { name: 'News articles' });

  it('lists articles with sentiment badges that carry text, not only colour', () => {
    renderWithProviders(<NewsFeed {...widgetProps(defaults, data)} />);
    expect(within(list()).getAllByRole('listitem')).toHaveLength(40);
    const labels = within(list()).getAllByText(/^(Positive|Negative|Neutral)$/);
    expect(labels).toHaveLength(40);
    expect(screen.getByText('Simulated stories · outlet names are labels only')).toBeVisible();
  });

  it('expands and collapses a summary', async () => {
    renderWithProviders(<NewsFeed {...widgetProps(defaults, data)} />);
    const first = data.articles[0];
    if (!first) throw new Error('no articles');
    const button = screen.getByRole('button', { name: first.headline });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(first.summary)).toBeInTheDocument();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.queryByText(first.summary)).not.toBeInTheDocument());
  });

  it('puts a newly arrived story at the top', () => {
    const { rerender } = renderWithProviders(<NewsFeed {...widgetProps(defaults, data)} />);
    const base = data.articles[0];
    if (!base) throw new Error('no articles');
    const fresh: FeedArticle = {
      ...base,
      articleId: 'wire-test-new',
      headline: 'A brand-new simulated story',
      publishedAt: '2026-10-20T11:59:00+05:30',
    };
    rerender(
      <NewsFeed {...widgetProps(defaults, { ...data, articles: [fresh, ...data.articles] })} />,
    );
    const first = within(list()).getAllByRole('listitem')[0];
    expect(first).toHaveTextContent('A brand-new simulated story');
  });

  it('changes the source and keyword through the config', async () => {
    const onConfigChange = vi.fn();
    renderWithProviders(<NewsFeed {...widgetProps(defaults, data, 800, 400, onConfigChange)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Source: All sources' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Bloomberg' }));
    expect(onConfigChange).toHaveBeenCalledWith({ source: 'Bloomberg' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter news by keyword' }), {
      target: { value: 'bank' },
    });
    await waitFor(() => expect(onConfigChange).toHaveBeenCalledWith({ keyword: 'bank' }));
  });

  it('narrows to a symbol sent with SYMBOL_SELECTED, and the chip clears it', () => {
    const ticker = data.articles.find((a) => a.relevantTickers.length > 0)?.relevantTickers[0];
    if (!ticker) throw new Error('no tickers in fixture');
    renderWithProviders(<NewsFeed {...widgetProps(defaults, data)} />);
    act(() => publishWidgetEvent({ type: 'SYMBOL_SELECTED', symbol: ticker }));
    expect(screen.getByText('Showing news for')).toBeInTheDocument();
    const shown = within(list()).getAllByRole('listitem').length;
    expect(shown).toBe(filterArticles(data.articles, defaults, ticker).length);
    fireEvent.click(screen.getByRole('button', { name: `Show all news, not only ${ticker}` }));
    expect(screen.queryByText('Showing news for')).not.toBeInTheDocument();
  });

  it('applies the configured filters', () => {
    renderWithProviders(<NewsFeed {...widgetProps(configuredConfig, data)} />);
    expect(screen.getByRole('button', { name: 'Source: Reuters' })).toBeInTheDocument();
    const shown = filterArticles(data.articles, configuredConfig, null);
    if (shown.length === 0) {
      expect(screen.getByText('No articles match')).toBeInTheDocument();
    } else {
      expect(within(list()).getAllByRole('listitem')).toHaveLength(shown.length);
    }
  });
});

describeWidgetStates('news-feed', { data: fixtureData, emptyData });
