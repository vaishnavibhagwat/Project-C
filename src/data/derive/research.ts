import type { Sector } from '@/types';
import { toIstIso } from '@/utils/time';
import { NIFTY50, SECTORS } from '../nifty50';
import { createRng, hashSeed, pick, type Rng } from '../random';
import type { ResearchData, ResearchItem } from '../schemas';
import { asOfIso, type DeriveContext } from './context';

export const RESEARCH_DISCLAIMER =
  'Sample research content generated for this demo. Not investment advice and not real news.';

const SLOT_MS = 17 * 60 * 1000;
export const RESEARCH_ITEMS = 40;
const ANALYSTS = ['A. Mehta', 'R. Iyer', 'S. Kulkarni', 'P. Nair', 'K. Banerjee', 'D. Rao'];

type Template = {
  category: ResearchItem['category'];
  sentiment: ResearchItem['sentiment'];
  scope: 'stock' | 'sector' | 'macro';
  headline: (subject: string) => string;
  summary: (subject: string) => string;
};

const TEMPLATES: Template[] = [
  {
    category: 'Earnings',
    sentiment: 'Positive',
    scope: 'stock',
    headline: (s) => `${s}: Q2 margins ahead of house estimates`,
    summary: (s) =>
      `Desk note: ${s} operating margin expanded on mix and cost control; we raise FY27 EPS estimates modestly.`,
  },
  {
    category: 'Earnings',
    sentiment: 'Negative',
    scope: 'stock',
    headline: (s) => `${s}: revenue growth slows, guidance trimmed`,
    summary: (s) =>
      `Desk note: ${s} cut full-year growth guidance citing softer demand; watch working-capital trends.`,
  },
  {
    category: 'Rating',
    sentiment: 'Positive',
    scope: 'stock',
    headline: (s) => `Internal rating on ${s} moved to Overweight`,
    summary: (s) =>
      `Sample view: valuation for ${s} now below five-year average with improving return ratios.`,
  },
  {
    category: 'Rating',
    sentiment: 'Negative',
    scope: 'stock',
    headline: (s) => `${s} moved to Underweight on valuation`,
    summary: (s) =>
      `Sample view: ${s} trades at a premium that leaves little room for execution risk.`,
  },
  {
    category: 'Sector',
    sentiment: 'Neutral',
    scope: 'sector',
    headline: (s) => `${s}: monthly data in line, positioning unchanged`,
    summary: (s) =>
      `Sector desk: ${s} volumes tracked seasonal norms; no change to the model portfolio tilt.`,
  },
  {
    category: 'Sector',
    sentiment: 'Positive',
    scope: 'sector',
    headline: (s) => `${s}: demand indicators improve for a third month`,
    summary: (s) =>
      `Sector desk: leading indicators for ${s} continue to firm; supports current overweight.`,
  },
  {
    category: 'Flows',
    sentiment: 'Neutral',
    scope: 'macro',
    headline: () => 'FPI flows mixed; domestic institutions net buyers',
    summary: () =>
      'Flows desk: domestic mutual funds absorbed foreign selling; cash-market breadth neutral.',
  },
  {
    category: 'Macro',
    sentiment: 'Neutral',
    scope: 'macro',
    headline: () => 'RBI policy: rates held, stance unchanged (sample)',
    summary: () =>
      'Macro desk: no change expected to duration positioning in the fixed-income sleeve.',
  },
  {
    category: 'Macro',
    sentiment: 'Negative',
    scope: 'macro',
    headline: () => 'Crude firms; watch impact on OMC margins and INR',
    summary: () =>
      'Macro desk: higher crude is a headwind for the current account; INR sensitivity rises.',
  },
  {
    category: 'Flows',
    sentiment: 'Positive',
    scope: 'macro',
    headline: () => 'SIP inflows hold near record levels (sample)',
    summary: () => 'Flows desk: retail systematic flows remain a steady support for large caps.',
  },
];

function buildItem(seed: number, slot: number): ResearchItem {
  const rng: Rng = createRng(hashSeed(seed, 'research', slot));
  const t = pick(rng, TEMPLATES);
  let subject = 'Markets';
  let symbol: string | null = null;
  let sector: Sector | null = null;
  if (t.scope === 'stock') {
    const c = pick(rng, NIFTY50);
    subject = c.name;
    symbol = c.symbol;
    sector = c.sector;
  } else if (t.scope === 'sector') {
    sector = pick(rng, SECTORS);
    subject = sector;
  }
  const jitter = Math.floor(rng() * (SLOT_MS - 60_000));
  return {
    id: `R${slot}`,
    publishedAt: toIstIso(slot * SLOT_MS + jitter),
    headline: t.headline(subject),
    summary: t.summary(subject),
    symbol,
    sector,
    sentiment: t.sentiment,
    category: t.category,
    analyst: pick(rng, ANALYSTS),
  };
}

/** One item per 17-minute slot, newest first. Deterministic per slot. */
export function deriveResearch(ctx: DeriveContext): ResearchData {
  const latestSlot = Math.floor(ctx.nowMs / SLOT_MS);
  const items: ResearchItem[] = [];
  for (let slot = latestSlot; slot > latestSlot - RESEARCH_ITEMS; slot -= 1) {
    const item = buildItem(ctx.dataset.seed, slot);
    if (Date.parse(item.publishedAt) <= ctx.nowMs) items.push(item);
  }
  return { asOf: asOfIso(ctx), simulated: true, disclaimer: RESEARCH_DISCLAIMER, items };
}
