import { z } from 'zod';
import { dateKey, finite, istIso, nonNegative, price, SectorSchema } from '../schemas';
import { BENCHMARK_IDS } from './benchmarks';
import { ASSET_CLASSES, GEOGRAPHIES, INSTRUMENT_TYPES } from './instruments';
import { NEWS_SOURCES } from './news';

/**
 * Schemas for the REST-style mock API (src/data/mockApi.ts). Every number is finite (z.number()
 * rejects NaN, `.finite()` rejects Infinity) and every price is strictly positive.
 */

const meta = { asOf: istIso, simulated: z.literal(true) };
const AssetClassSchema = z.enum(ASSET_CLASSES);
const GeographySchema = z.enum(GEOGRAPHIES);
const Currency = z.enum(['INR', 'USD']);
/** Signed percentage; daily moves and period returns stay well inside ±1000%. */
const signedPct = finite.min(-100).max(1000);
const weightPct = finite.min(0).max(100);

const Breakdown = <T extends z.ZodTypeAny>(key: T) =>
  z.object({ key, valueInr: nonNegative, weightPct });

/** Weights in a breakdown or a holdings list must add up to 100% (within rounding). */
function sumsTo100(rows: readonly { weightPct: number }[]): boolean {
  return Math.abs(rows.reduce((s, r) => s + r.weightPct, 0) - 100) < 0.05;
}

export const PortfolioResponseSchema = z.object({
  ...meta,
  portfolioId: z.string().min(1),
  name: z.string().min(1),
  baseCurrency: z.literal('INR'),
  aumInr: price,
  aumUsd: price,
  fxUsdInr: price,
  nav: price,
  navChangePct: signedPct,
  dailyPnlInr: finite,
  holdingsCount: z.number().int().positive(),
  benchmark: z.string().min(1),
  assetClasses: z
    .array(Breakdown(AssetClassSchema))
    .length(4)
    .refine(sumsTo100, 'Asset-class weights must sum to 100%'),
  geographies: z
    .array(Breakdown(GeographySchema))
    .length(4)
    .refine(sumsTo100, 'Geography weights must sum to 100%'),
});

export const MockHoldingSchema = z.object({
  holdingId: z.string().min(1),
  ticker: z.string().min(1),
  name: z.string().min(1),
  assetClass: AssetClassSchema,
  instrumentType: z.enum(INSTRUMENT_TYPES),
  geography: GeographySchema,
  exchange: z.string().min(1),
  sector: SectorSchema.nullable(),
  currency: Currency,
  quantity: z.number().int().positive(),
  averageCost: price,
  price,
  previousClose: price,
  priceInr: price,
  marketValue: nonNegative,
  marketValueInr: nonNegative,
  exposureInr: finite,
  unrealisedPnlInr: finite,
  dailyChangePct: signedPct,
  dailyPnlInr: finite,
  weightPct,
});

export const HoldingsResponseSchema = z.object({
  ...meta,
  portfolioId: z.string().min(1),
  totalValueInr: price,
  holdings: z.array(MockHoldingSchema).min(1).refine(sumsTo100, 'Holding weights must sum to 100%'),
});

const BenchmarkSchema = z.object({
  id: z.enum(BENCHMARK_IDS),
  name: z.string().min(1),
  currency: Currency,
  levels: z.array(price),
  returnPct: signedPct,
});

const PeriodReturn = z.object({
  period: z.enum(['1M', '3M', '6M', '1Y', '3Y']),
  fundPct: signedPct,
  benchmarkPct: signedPct,
});

export const PerformanceResponseSchema = z
  .object({
    ...meta,
    portfolioId: z.string().min(1),
    dates: z.array(dateKey).min(2),
    nav: z.array(price),
    drawdownPct: z.array(finite.min(-100).max(0)),
    benchmarks: z.array(BenchmarkSchema).length(BENCHMARK_IDS.length),
    periodReturns: z.array(PeriodReturn),
    maxDrawdown: z.object({
      depthPct: finite.min(0).max(100),
      peakDate: dateKey,
      troughDate: dateKey,
      /** First date the NAV regained the peak; null while still under water. */
      recoveryDate: dateKey.nullable(),
    }),
  })
  .refine(
    (d) =>
      d.nav.length === d.dates.length &&
      d.drawdownPct.length === d.dates.length &&
      d.benchmarks.every((b) => b.levels.length === d.dates.length),
    'Every series must have one value per date',
  );

export const RiskResponseSchema = z.object({
  ...meta,
  portfolioId: z.string().min(1),
  lookbackDays: z.number().int().positive(),
  var95Pct: nonNegative,
  var99Pct: nonNegative,
  var95Inr: nonNegative,
  var99Inr: nonNegative,
  cvar95Pct: nonNegative,
  volatilityPct: nonNegative,
  rollingVolatilityPct: nonNegative,
  volatilityRegime: z.enum(['calm', 'normal', 'elevated', 'stressed']),
  betaToNifty: finite,
  trackingErrorPct: nonNegative,
  sharpe: finite,
  sortino: finite,
  maxDrawdownPct: finite.min(0).max(100),
  grossExposureInr: nonNegative,
  netExposureInr: finite,
  derivativesNotionalInr: nonNegative,
  exposureByAssetClass: z.array(z.object({ key: AssetClassSchema, exposureInr: finite })),
  exposureByGeography: z.array(z.object({ key: GeographySchema, exposureInr: finite })),
});

const IndexQuote = z.object({
  id: z.enum(BENCHMARK_IDS),
  name: z.string().min(1),
  currency: Currency,
  last: price,
  previousClose: price,
  changePct: signedPct,
  oneYearPct: signedPct,
});

const Mover = z.object({
  ticker: z.string().min(1),
  name: z.string().min(1),
  last: price,
  changePct: signedPct,
});

export const MarketOverviewResponseSchema = z.object({
  ...meta,
  tradeDate: dateKey,
  session: z.object({ phase: z.enum(['pre-open', 'open', 'closed']), label: z.string() }),
  fxUsdInr: price,
  indices: z.array(IndexQuote).length(BENCHMARK_IDS.length),
  breadth: z.object({
    advances: z.number().int().nonnegative(),
    declines: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
  }),
  topGainers: z.array(Mover),
  topLosers: z.array(Mover),
  sectors: z.array(z.object({ sector: SectorSchema, changePct: signedPct })),
});

export const MockNewsSchema = z.object({
  articleId: z.string().min(1),
  headline: z.string().min(1),
  summary: z.string().min(1),
  source: z.enum(NEWS_SOURCES),
  publishedAt: istIso,
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  sentimentScore: finite.min(-1).max(1),
  priceMovePct: signedPct,
  relevantTickers: z.array(z.string()),
  category: z.enum(['earnings', 'macro', 'sector', 'rating', 'flows']),
});

export const NewsResponseSchema = z.object({
  ...meta,
  articles: z.array(MockNewsSchema),
});

export const MockAlertSchema = z.object({
  alertId: z.string().min(1),
  type: z.enum(['price_breach', 'risk_limit', 'news_event', 'rebalance_signal']),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string().min(1),
  triggeredAt: istIso,
  relatedWidget: z.string().min(1),
  relatedEntity: z.string().min(1),
  acknowledged: z.boolean(),
  volatilityPct: nonNegative,
});

export const AlertsResponseSchema = z.object({
  ...meta,
  days: z.number().int().positive(),
  currentVolatilityPct: nonNegative,
  medianVolatilityPct: nonNegative,
  alerts: z.array(MockAlertSchema),
});

export type PortfolioResponse = z.infer<typeof PortfolioResponseSchema>;
export type MockHolding = z.infer<typeof MockHoldingSchema>;
export type HoldingsResponse = z.infer<typeof HoldingsResponseSchema>;
export type PerformanceResponse = z.infer<typeof PerformanceResponseSchema>;
export type RiskResponse = z.infer<typeof RiskResponseSchema>;
export type MarketOverviewResponse = z.infer<typeof MarketOverviewResponseSchema>;
export type NewsResponse = z.infer<typeof NewsResponseSchema>;
export type AlertsResponse = z.infer<typeof AlertsResponseSchema>;
