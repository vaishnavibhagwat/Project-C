import type { ResearchFeedConfig, ResearchItem } from './types';

export function filterResearch(
  items: readonly ResearchItem[],
  config: ResearchFeedConfig,
): ResearchItem[] {
  return items.filter(
    (i) =>
      (config.sentiment === 'ALL' || i.sentiment === config.sentiment) &&
      (config.category === 'ALL' || i.category === config.category),
  );
}
