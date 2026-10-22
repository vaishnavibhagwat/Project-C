import { lazy } from 'react';
import { IconNews } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { registerWidget } from '@/registry/defineWidget';
import { env } from '@/utils/env';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { filterArticles, titleCase } from './model';
import {
  CATEGORY_FILTERS,
  ResearchFeedConfigSchema,
  SENTIMENT_FILTERS,
  type ResearchFeedConfig,
  type ResearchFeedData,
} from './types';

export const researchFeedDefinition: WidgetDefinition<ResearchFeedConfig, ResearchFeedData> = {
  id: 'research-feed',
  name: 'Research Feed',
  description:
    'Sample research notes generated for the demo (not real news, not advice). Filter by sentiment and category.',
  category: WidgetCategory.FEED,
  defaultSize: { w: 6, h: 8 },
  minSize: { w: 3, h: 6 },
  configSchema: {
    type: 'object',
    properties: {
      sentiment: {
        title: 'Sentiment',
        oneOf: SENTIMENT_FILTERS.map((v) => ({ const: v, title: titleCase(v) })),
      },
      category: {
        title: 'Category',
        oneOf: CATEGORY_FILTERS.map((v) => ({ const: v, title: titleCase(v) })),
      },
      showSummary: { type: 'boolean', title: 'Show summaries' },
    },
  },
  defaultConfig: { sentiment: 'all', category: 'all', showSummary: true },
  component: lazy(() => import('./index')),
  icon: IconNews,
  dataSource: {
    endpoint: 'research/feed',
    wsChannel: 'research.notes',
    refreshInterval: env.VITE_DATA_REFRESH_INTERVAL,
    latencyProfile: 'normal',
  },
};

export function summarizeResearch(data: ResearchFeedData, config: ResearchFeedConfig): string {
  const articles = filterArticles(data.articles, config);
  const latest = articles[0];
  return `${articles.length} sample research articles. ${latest ? `Latest: ${latest.headline} (${latest.sentiment}, score ${latest.sentimentScore.toFixed(2)}).` : ''}`;
}

export const researchFeedWidget = registerWidget(researchFeedDefinition, {
  configParser: ResearchFeedConfigSchema,
  isData: isEndpointData('research/feed'),
  isEmpty: (d) => d.articles.length === 0,
  summarize: summarizeResearch,
  skeleton: 'feed',
  preload: () => import('./index'),
});
