import { lazy } from 'react';
import { IconNews } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { registerWidget } from '@/registry/defineWidget';
import { env } from '@/utils/env';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { filterResearch } from './model';
import { ResearchFeedConfigSchema, type ResearchFeedConfig, type ResearchFeedData } from './types';

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
        oneOf: ['ALL', 'Positive', 'Neutral', 'Negative'].map((v) => ({
          const: v,
          title: v === 'ALL' ? 'All' : v,
        })),
      },
      category: {
        title: 'Category',
        oneOf: ['ALL', 'Earnings', 'Macro', 'Sector', 'Rating', 'Flows'].map((v) => ({
          const: v,
          title: v === 'ALL' ? 'All' : v,
        })),
      },
      showSummary: { type: 'boolean', title: 'Show summaries' },
    },
  },
  defaultConfig: { sentiment: 'ALL', category: 'ALL', showSummary: true },
  component: lazy(() => import('./index')),
  icon: IconNews,
  dataSource: { endpoint: 'research/feed', refreshIntervalMs: env.VITE_DATA_REFRESH_INTERVAL },
};

export function summarizeResearch(data: ResearchFeedData, config: ResearchFeedConfig): string {
  const items = filterResearch(data.items, config);
  const latest = items[0];
  return `${items.length} sample research items. ${latest ? `Latest: ${latest.headline} (${latest.sentiment}).` : ''}`;
}

export const researchFeedWidget = registerWidget(researchFeedDefinition, {
  configParser: ResearchFeedConfigSchema,
  isData: isEndpointData('research/feed'),
  isEmpty: (d) => d.items.length === 0,
  summarize: summarizeResearch,
  skeleton: 'feed',
  preload: () => import('./index'),
});
