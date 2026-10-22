import type { NewsArticle, NewsCategory, Sector, Sentiment } from '@/types';
import { toIstIso } from '@/utils/time';
import { NIFTY50, SECTORS } from '../nifty50';
import { createRng, hashSeed, pick, uniform, type Rng } from '../random';
import type { ResearchData } from '../schemas';
import { asOfIso, type DeriveContext } from './context';

export const RESEARCH_DISCLAIMER =
  'Sample research content generated for this demo. Not investment advice and not real news.';

const SLOT_MS = 17 * 60 * 1000;
export const RESEARCH_ITEMS = 40;
const ANALYSTS = ['A. Mehta', 'R. Iyer', 'S. Kulkarni', 'P. Nair', 'K. Banerjee', 'D. Rao'];

type Template = {
  category: NewsCategory;
  sentiment: Sentiment;
  scope: 'stock' | 'sector' | 'macro';
  headline: (subject: string) => string;
  summary: (subject: string) => string;
};

const TEMPLATES: Template[] = [
  {
    category: 'earnings',
    sentiment: 'positive',
    scope: 'stock',
    headline: (s) => `${s}: Q2 margins ahead of house estimates`,
    summary: (s) =>
      `Desk note: ${s} operating margin expanded on mix and cost control; we raise FY27 EPS estimates modestly.`,
  },
  {
    category: 'earnings',
    sentiment: 'negative',
    scope: 'stock',
    headline: (s) => `${s}: revenue growth slows, guidance trimmed`,
    summary: (s) =>
      `Desk note: ${s} cut full-year growth guidance citing softer demand; watch working-capital trends.`,
  },
  {
    category: 'rating',
    sentiment: 'positive',
    scope: 'stock',
    headline: (s) => `Internal rating on ${s} moved to Overweight`,
    summary: (s) =>
      `Sample view: valuation for ${s} now below five-year average with improving return ratios.`,
  },
  {
    category: 'rating',
    sentiment: 'negative',
    scope: 'stock',
    headline: (s) => `${s} moved to Underweight on valuation`,
    summary: (s) =>
      `Sample view: ${s} trades at a premium that leaves little room for execution risk.`,
  },
  {
    category: 'sector',
    sentiment: 'neutral',
    scope: 'sector',
    headline: (s) => `${s}: monthly data in line, positioning unchanged`,
    summary: (s) =>
      `Sector desk: ${s} volumes tracked seasonal norms; no change to the model portfolio tilt.`,
  },
  {
    category: 'sector',
    sentiment: 'positive',
    scope: 'sector',
    headline: (s) => `${s}: demand indicators improve for a third month`,
    summary: (s) =>
      `Sector desk: leading indicators for ${s} continue to firm; supports current overweight.`,
  },
  {
    category: 'flows',
    sentiment: 'neutral',
    scope: 'macro',
    headline: () => 'FPI flows mixed; domestic institutions net buyers',
    summary: () =>
      'Flows desk: domestic mutual funds absorbed foreign selling; cash-market breadth neutral.',
  },
  {
    category: 'macro',
    sentiment: 'neutral',
    scope: 'macro',
    headline: () => 'RBI policy: rates held, stance unchanged (sample)',
    summary: () =>
      'Macro desk: no change expected to duration positioning in the fixed-income sleeve.',
  },
  {
    category: 'macro',
    sentiment: 'negative',
    scope: 'macro',
    headline: () => 'Crude firms; watch impact on OMC margins and INR',
    summary: () =>
      'Macro desk: higher crude is a headwind for the current account; INR sensitivity rises.',
  },
  {
    category: 'flows',
    sentiment: 'positive',
    scope: 'macro',
    headline: () => 'SIP inflows hold near record levels (sample)',
    summary: () => 'Flows desk: retail systematic flows remain a steady support for large caps.',
  },
];

/** Score range per sentiment; the score is drawn uniformly inside it. */
const SCORE_RANGE: Record<Sentiment, [number, number]> = {
  positive: [0.35, 0.95],
  neutral: [-0.2, 0.2],
  negative: [-0.95, -0.35],
};

/** Largest index constituents of a sector, used as the tickers a sector note concerns. */
function sectorTickers(sector: Sector, count = 3): string[] {
  return NIFTY50.filter((c) => c.sector === sector)
    .sort((a, b) => b.indexWeight - a.indexWeight)
    .slice(0, count)
    .map((c) => c.symbol);
}

function buildArticle(seed: number, slot: number): NewsArticle {
  const rng: Rng = createRng(hashSeed(seed, 'research', slot));
  const t = pick(rng, TEMPLATES);
  let subject = 'Markets';
  let relevantTickers: string[] = [];
  if (t.scope === 'stock') {
    const c = pick(rng, NIFTY50);
    subject = c.name;
    relevantTickers = [c.symbol];
  } else if (t.scope === 'sector') {
    const sector = pick(rng, SECTORS);
    subject = sector;
    relevantTickers = sectorTickers(sector);
  }
  const jitter = Math.floor(rng() * (SLOT_MS - 60_000));
  const analyst = pick(rng, ANALYSTS);
  const [lo, hi] = SCORE_RANGE[t.sentiment];
  return {
    articleId: `NEWS-${slot}`,
    headline: t.headline(subject),
    summary: t.summary(subject),
    source: `Meridian Research · ${analyst} (sample)`,
    publishedAt: toIstIso(slot * SLOT_MS + jitter),
    sentiment: t.sentiment,
    sentimentScore: Math.round(uniform(rng, lo, hi) * 100) / 100,
    relevantTickers,
    category: t.category,
  };
}

/** One article per 17-minute slot, newest first. Deterministic per slot. */
export function deriveResearch(ctx: DeriveContext): ResearchData {
  const latestSlot = Math.floor(ctx.nowMs / SLOT_MS);
  const articles: NewsArticle[] = [];
  for (let slot = latestSlot; slot > latestSlot - RESEARCH_ITEMS; slot -= 1) {
    const article = buildArticle(ctx.dataset.seed, slot);
    if (Date.parse(article.publishedAt) <= ctx.nowMs) articles.push(article);
  }
  return { asOf: asOfIso(ctx), simulated: true, disclaimer: RESEARCH_DISCLAIMER, articles };
}
