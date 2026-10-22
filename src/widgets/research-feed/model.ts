import type { NewsArticle, ResearchFeedConfig } from './types';

export function filterArticles(
  articles: readonly NewsArticle[],
  config: ResearchFeedConfig,
): NewsArticle[] {
  return articles.filter(
    (a) =>
      (config.sentiment === 'all' || a.sentiment === config.sentiment) &&
      (config.category === 'all' || a.category === config.category),
  );
}

/** "earnings" -> "Earnings" for display. */
export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
