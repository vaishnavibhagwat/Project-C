import type { NewsArticle } from '@/types';
import { lastClose, previousClose } from '../dataset';
import { NEWS_SOURCES, type MockNewsItem } from '../mock/news';
import { wireUntil, type WireStock } from '../mock/wire';
import { mockWorld } from '../mock/world';
import type { MarketNewsData } from '../schemas';
import { asOfIso, type DeriveContext } from './context';

/** Articles returned by market/news, newest first. */
export const MARKET_NEWS_LIMIT = 80;

export const MARKET_NEWS_DISCLAIMER =
  'Simulated, templated stories generated from the demo dataset. Outlet names are labels only; none of this is real reporting.';

const wireCache = new WeakMap<DeriveContext['dataset'], WireStock[]>();

/** The Nifty 50 constituents with their last-session move, for the wire's templates. */
function wireStocks(ctx: DeriveContext): WireStock[] {
  const hit = wireCache.get(ctx.dataset);
  if (hit) return hit;
  const stocks = ctx.dataset.constituents.map((c, i) => {
    const prev = previousClose(ctx.dataset, i);
    return {
      ticker: c.symbol,
      name: c.name,
      sector: c.sector,
      move: prev > 0 ? lastClose(ctx.dataset, i) / prev - 1 : 0,
    };
  });
  wireCache.set(ctx.dataset, stocks);
  return stocks;
}

const toArticle = (n: MockNewsItem): NewsArticle => ({
  articleId: n.articleId,
  headline: n.headline,
  summary: n.summary,
  source: n.source,
  publishedAt: n.publishedAt,
  sentiment: n.sentiment,
  sentimentScore: n.sentimentScore,
  relevantTickers: n.relevantTickers,
  category: n.category,
});

/**
 * market/news: the model's daily post-close stories plus the simulated intraday wire, published
 * up to "now", newest first. Every item is templated from the demo dataset.
 */
export function deriveMarketNews(ctx: DeriveContext): MarketNewsData {
  const daily = mockWorld(ctx.dataset).news.filter((n) => n.publishedMs <= ctx.nowMs);
  const wire = wireUntil(wireStocks(ctx), ctx.dataset.seed, ctx.nowMs, MARKET_NEWS_LIMIT);
  const articles = [...wire, ...daily.slice(0, MARKET_NEWS_LIMIT)]
    .sort((a, b) => b.publishedMs - a.publishedMs)
    .slice(0, MARKET_NEWS_LIMIT)
    .map(toArticle);
  return {
    asOf: asOfIso(ctx),
    simulated: true,
    disclaimer: MARKET_NEWS_DISCLAIMER,
    sources: [...NEWS_SOURCES],
    articles,
  };
}
