import { lazy } from 'react';
import { IconNews } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { filterArticles, summarizeFeed } from './model';
import { NewsFeedConfigSchema, type NewsFeedConfig, type NewsFeedData } from './types';

/** Brief: poll every 20 s, with new stories pushed on ws://mock/news/stream in between. */
export const NEWS_FEED_REFRESH_MS = 20_000;

export const newsFeedDefinition: WidgetDefinition<NewsFeedConfig, NewsFeedData> = {
  id: 'news-feed',
  name: 'News Feed',
  description:
    'Simulated market news with keyword and source filters, sentiment badges and expandable summaries. New stories slide in at the top.',
  category: WidgetCategory.FEED,
  defaultSize: { w: 3, h: 4 },
  minSize: { w: 3, h: 3 },
  maxSize: { w: 8, h: 10 },
  configSchema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        title: 'Keyword filter',
        description: 'Every word must appear in the headline, summary, tickers or source.',
        maxLength: 60,
      },
      source: {
        title: 'Source',
        oneOf: [
          { const: 'all', title: 'All sources' },
          ...['Reuters', 'Bloomberg', 'Economic Times', 'Moneycontrol'].map((s) => ({
            const: s,
            title: s,
          })),
        ],
      },
      limit: {
        title: 'Articles shown',
        oneOf: ['20', '40', '80'].map((n) => ({ const: n, title: n })),
      },
    },
  },
  defaultConfig: { keyword: '', source: 'all', limit: '40' },
  component: lazy(() => import('./index')),
  icon: IconNews,
  dataSource: {
    endpoint: 'market/news',
    wsChannel: 'ws://mock/news/stream',
    refreshInterval: NEWS_FEED_REFRESH_MS,
    latencyProfile: 'normal',
  },
};

export function summarizeNewsFeed(data: NewsFeedData, config: NewsFeedConfig): string {
  return summarizeFeed(filterArticles(data.articles, config, null));
}

export const newsFeedWidget = defineWidget(newsFeedDefinition, {
  configParser: NewsFeedConfigSchema,
  isData: isEndpointData('market/news'),
  isEmpty: (d) => d.articles.length === 0,
  summarize: summarizeNewsFeed,
  skeleton: 'feed',
  preload: () => import('./index'),
});
