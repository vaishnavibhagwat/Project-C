import type { NewsCategory, Sentiment } from '@/types';
import { istTimeMs, toIstIso } from '@/utils/time';
import { createRng, hashSeed, normal, pick, uniform, type Rng } from '../random';
import type { BenchmarkSeries } from './benchmarks';
import type { Instrument } from './instruments';
import type { MockWindow } from './window';

export const NEWS_SOURCES = ['Reuters', 'Bloomberg', 'Economic Times', 'Moneycontrol'] as const;
export type NewsSource = (typeof NEWS_SOURCES)[number];

/** Trading days of news kept (the newest first in responses). */
export const NEWS_DAYS = 30;

export interface MockNewsItem {
  articleId: string;
  headline: string;
  summary: string;
  source: NewsSource;
  /** IST ISO timestamp. */
  publishedAt: string;
  /** Epoch ms of publishedAt (for filtering by "now"). */
  publishedMs: number;
  sentiment: Sentiment;
  /** −1 to 1. Follows the price move it reports on, plus noise. */
  sentimentScore: number;
  /** The simulated daily move the story reacts to, percent. */
  priceMovePct: number;
  relevantTickers: string[];
  category: NewsCategory;
}

/** Sentiment loosely tracks the move: tanh(move / 1.5%) plus N(0, 0.3) noise, clipped to ±1. */
export function sentimentFor(rng: Rng, move: number): { score: number; label: Sentiment } {
  const score = Math.max(-1, Math.min(1, Math.tanh(move / 0.015) + 0.3 * normal(rng)));
  const label: Sentiment = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';
  return { score: Math.round(score * 100) / 100, label };
}

function verb(move: number): string {
  const size = Math.abs(move);
  if (move >= 0) return size > 0.03 ? 'jump' : size > 0.01 ? 'rise' : 'edge up';
  return size > 0.03 ? 'slump' : size > 0.01 ? 'fall' : 'slip';
}

const pctText = (move: number) => `${(Math.abs(move) * 100).toFixed(1)}%`;

const SECTOR_INDEX: { id: string; label: string; tickers: string[] }[] = [
  { id: 'NIFTYBANK', label: 'Bank stocks', tickers: ['HDFCBANK', 'ICICIBANK', 'AXISBANK', 'SBIN'] },
  { id: 'NIFTYIT', label: 'IT stocks', tickers: ['INFY', 'TCS', 'HCLTECH', 'WIPRO'] },
  { id: 'NIFTYPHARMA', label: 'Pharma stocks', tickers: ['SUNPHARMA', 'CIPLA', 'DRREDDY'] },
];

/**
 * Simulated news for the last NEWS_DAYS trading days: 4–7 items a day from Reuters, Bloomberg,
 * Economic Times and Moneycontrol. Each item reports a move that actually happened in the
 * simulation (a holding, a sector index or the Nifty 50), and its sentiment follows that move
 * loosely. Headlines are templates; none of this is real reporting.
 */
export function buildNews(
  w: MockWindow,
  instruments: readonly Instrument[],
  benchmarks: readonly BenchmarkSeries[],
): MockNewsItem[] {
  const stocks = instruments.filter((i) => i.instrumentType === 'Stock');
  const levels = (id: string) => benchmarks.find((b) => b.id === id)?.levels ?? [];
  const items: MockNewsItem[] = [];
  const first = Math.max(1, w.dates.length - NEWS_DAYS);

  for (let t = first; t < w.dates.length; t += 1) {
    const date = w.dates[t] ?? '';
    const rng = createRng(hashSeed(w.dataset.seed, date, 'mock-news'));
    const move = (series: readonly number[]) => (series[t] ?? 1) / (series[t - 1] ?? 1) - 1;
    const moves = stocks.map((s) => ({ s, r: move(s.closes) }));
    const count = 4 + Math.floor(rng() * 4);

    for (let k = 0; k < count; k += 1) {
      const roll = rng();
      let headline: string;
      let summary: string;
      let r: number;
      let tickers: string[];
      let category: NewsCategory;
      // Post-close stories; the morning wrap is published before the open.
      let minutes = Math.round(uniform(rng, 15 * 60 + 40, 20 * 60));

      if (roll < 0.65 && moves.length > 0) {
        // A holding, more likely the bigger movers.
        const total = moves.reduce((s, m) => s + Math.abs(m.r) + 0.004, 0);
        let target = rng() * total;
        const chosen = moves.find((m) => (target -= Math.abs(m.r) + 0.004) <= 0) ?? moves[0];
        if (!chosen) continue;
        r = chosen.r;
        tickers = [chosen.s.ticker];
        category = pick(rng, ['earnings', 'rating', 'flows'] as const);
        headline = `${chosen.s.name} shares ${verb(r)} ${pctText(r)}`;
        summary = `Simulated story: ${chosen.s.name} closed ${r >= 0 ? 'up' : 'down'} ${pctText(r)} at ₹${(chosen.s.closes[t] ?? 0).toFixed(2)} on ${date} in the demo dataset.`;
      } else if (roll < 0.88) {
        const sector = pick(rng, SECTOR_INDEX);
        r = move(levels(sector.id));
        tickers = sector.tickers;
        category = 'sector';
        headline = `${sector.label} ${verb(r)} ${pctText(r)} as ${r >= 0 ? 'buyers return' : 'selling deepens'}`;
        summary = `Simulated story: the ${sector.id.replace('NIFTY', 'Nifty ')} index moved ${r >= 0 ? '+' : '−'}${pctText(r)} on ${date} in the demo dataset.`;
      } else {
        r = move(levels('NIFTY50'));
        tickers = [];
        category = 'macro';
        minutes = Math.round(uniform(rng, 7 * 60 + 30, 9 * 60 + 5));
        headline = `Markets wrap: Nifty 50 ${verb(r)} ${pctText(r)}`;
        summary = `Simulated story: the Nifty 50 moved ${r >= 0 ? '+' : '−'}${pctText(r)} on ${date} in the demo dataset; breadth and flows are illustrative.`;
      }

      // Pre-open wraps describe the previous session and are dated the next morning; the
      // latest session has no next morning yet, so its wrap goes out that evening.
      const next = w.dates[t + 1];
      if (category === 'macro' && next === undefined) minutes = 20 * 60;
      const day = category === 'macro' && next !== undefined ? next : date;
      const ms = istTimeMs(day, Math.floor(minutes / 60), minutes % 60);
      const sentiment = sentimentFor(rng, r);
      items.push({
        articleId: `news-${date}-${k}`,
        headline,
        summary,
        source: pick(rng, NEWS_SOURCES),
        publishedAt: toIstIso(ms),
        publishedMs: ms,
        sentiment: sentiment.label,
        sentimentScore: sentiment.score,
        priceMovePct: Math.round(r * 10_000) / 100,
        relevantTickers: tickers,
        category,
      });
    }
  }
  return items.sort((a, b) => b.publishedMs - a.publishedMs);
}
