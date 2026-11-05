import type { NewsCategory } from '@/types';
import { istDateKey, istTimeMs, toIstIso } from '@/utils/time';
import { createRng, hashSeed, pick, uniform } from '../random';
import { NEWS_SOURCES, sentimentFor, type MockNewsItem } from './news';

/** A stock the wire can write about: its name and last-session move. */
export interface WireStock {
  ticker: string;
  name: string;
  sector: string;
  /** Last session's close-to-close move, as a fraction. */
  move: number;
}

/** Seconds between wire stories: uniform in this range, so the feed keeps moving in a demo. */
export const WIRE_GAP_SECONDS: readonly [number, number] = [60, 240];

const MACRO_TOPICS = [
  'RBI policy preview',
  'Rupee steady against the dollar',
  'Crude oil prices',
  'Government bond yields',
  'FII and DII flows',
  'Monsoon update',
] as const;

const pctText = (move: number) => `${(Math.abs(move) * 100).toFixed(1)}%`;

function wireItem(
  stocks: readonly WireStock[],
  seed: number,
  day: string,
  k: number,
  ms: number,
): MockNewsItem {
  const rng = createRng(hashSeed(seed, day, 'wire-item', k));
  const roll = rng();
  const stock = pick(rng, stocks);
  let headline: string;
  let summary: string;
  let move: number;
  let tickers: string[];
  let category: NewsCategory;
  if (roll < 0.45) {
    move = stock.move;
    tickers = [stock.ticker];
    category = 'flows';
    headline = `${stock.name} in focus after ${pctText(move)} ${move >= 0 ? 'gain' : 'drop'} last session`;
    summary = `Simulated story: ${stock.name} (${stock.ticker}) moved ${move >= 0 ? '+' : '−'}${pctText(move)} in the previous session of the demo dataset.`;
  } else if (roll < 0.75) {
    const raise = rng() < 0.5 + stock.move * 10;
    move = raise ? 0.012 : -0.012;
    tickers = [stock.ticker];
    category = 'rating';
    headline = `Brokerage ${raise ? 'raises' : 'trims'} target on ${stock.name}`;
    summary = `Simulated story: an illustrative analyst note ${raise ? 'raising' : 'trimming'} the target on ${stock.name}. No real broker or note exists.`;
  } else if (roll < 0.9) {
    const peers = stocks.filter((s) => s.sector === stock.sector);
    move = peers.reduce((s, p) => s + p.move, 0) / Math.max(1, peers.length);
    tickers = peers.slice(0, 4).map((p) => p.ticker);
    category = 'sector';
    headline = `${stock.sector}: flows turn ${move >= 0 ? 'positive' : 'cautious'}`;
    summary = `Simulated story: ${stock.sector} names moved ${move >= 0 ? '+' : '−'}${pctText(move)} on average in the previous session of the demo dataset.`;
  } else {
    move = (rng() - 0.5) * 0.01;
    tickers = [];
    category = 'macro';
    headline = `Macro: ${pick(rng, MACRO_TOPICS)}`;
    summary =
      'Simulated story: an illustrative macro headline for the demo. It reports no real data.';
  }
  const sentiment = sentimentFor(rng, move);
  return {
    articleId: `wire-${day}-${k}`,
    headline,
    summary,
    source: pick(rng, NEWS_SOURCES),
    publishedAt: toIstIso(ms),
    publishedMs: ms,
    sentiment: sentiment.label,
    sentimentScore: sentiment.score,
    priceMovePct: Math.round(move * 10_000) / 100,
    relevantTickers: tickers,
    category,
  };
}

/**
 * Simulated wire stories for one IST calendar day: one every 1–4 minutes (seeded), around the
 * clock, so new items keep arriving while the dashboard is open. Content depends only on the
 * seed, the day and the stocks' last-session moves, so a story never changes once published.
 */
export function wireDay(stocks: readonly WireStock[], seed: number, day: string): MockNewsItem[] {
  if (stocks.length === 0) return [];
  const rng = createRng(hashSeed(seed, day, 'wire-times'));
  const start = istTimeMs(day, 0, 0);
  const end = start + 24 * 3_600_000;
  const items: MockNewsItem[] = [];
  let t = start + uniform(rng, WIRE_GAP_SECONDS[0], WIRE_GAP_SECONDS[1]) * 1000;
  for (let k = 0; t < end; k += 1) {
    items.push(wireItem(stocks, seed, day, k, Math.round(t)));
    t += uniform(rng, WIRE_GAP_SECONDS[0], WIRE_GAP_SECONDS[1]) * 1000;
  }
  return items;
}

/** Wire stories published up to `nowMs`, newest first, at most `limit` (today and yesterday). */
export function wireUntil(
  stocks: readonly WireStock[],
  seed: number,
  nowMs: number,
  limit: number,
): MockNewsItem[] {
  const today = istDateKey(nowMs);
  const yesterday = istDateKey(nowMs - 24 * 3_600_000);
  return [...wireDay(stocks, seed, today), ...wireDay(stocks, seed, yesterday)]
    .filter((a) => a.publishedMs <= nowMs)
    .sort((a, b) => b.publishedMs - a.publishedMs)
    .slice(0, limit);
}
