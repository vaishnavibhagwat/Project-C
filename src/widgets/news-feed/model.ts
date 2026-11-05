import type { FeedArticle, NewsFeedConfig } from './types';

/** Articles from the response and the latest stream message, de-duplicated, newest first. */
export function mergeArticles(
  polled: readonly FeedArticle[],
  streamed: readonly FeedArticle[],
  sources: readonly string[],
): FeedArticle[] {
  const byId = new Map<string, FeedArticle>();
  // The stream also carries in-house research; keep only this feed's outlets.
  for (const a of streamed) if (sources.includes(a.source)) byId.set(a.articleId, a);
  for (const a of polled) byId.set(a.articleId, a);
  return [...byId.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Source, keyword (every word, anywhere) and selected-symbol filters, then the limit. */
export function filterArticles(
  articles: readonly FeedArticle[],
  config: NewsFeedConfig,
  symbol: string | null,
): FeedArticle[] {
  const words = config.keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return articles
    .filter((a) => config.source === 'all' || a.source === config.source)
    .filter((a) => symbol === null || a.relevantTickers.includes(symbol))
    .filter((a) => {
      if (words.length === 0) return true;
      const text = [a.headline, a.summary, a.source, ...a.relevantTickers].join(' ').toLowerCase();
      return words.every((w) => text.includes(w));
    })
    .slice(0, Number(config.limit));
}

export function summarizeFeed(articles: readonly FeedArticle[]): string {
  const latest = articles[0];
  if (!latest) return 'No articles.';
  const counts = { positive: 0, negative: 0, neutral: 0 };
  for (const a of articles) counts[a.sentiment] += 1;
  return `${articles.length} simulated articles: ${counts.positive} positive, ${counts.negative} negative, ${counts.neutral} neutral. Latest: ${latest.headline} (${latest.source}, ${latest.sentiment}).`;
}
