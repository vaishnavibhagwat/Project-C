import { z } from 'zod';
import type { Alert, Holding, NewsArticle, Portfolio } from '@/types';

/**
 * Runtime validation for every mock API response. z.number() already rejects NaN; `.finite()`
 * rejects Infinity; prices must be strictly positive.
 */

export const finite = z.number().finite();
export const price = z.number().finite().positive();
export const nonNegative = z.number().finite().nonnegative();
export const pct = z.number().finite().min(-100).max(100);
export const fraction = z.number().finite().min(-1).max(1);
export const istIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$/, 'Expected an IST ISO timestamp');
export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const SectorSchema = z.enum([
  'Financial Services',
  'Information Technology',
  'Oil, Gas & Fuels',
  'FMCG',
  'Automobile',
  'Metals & Mining',
  'Construction Materials',
  'Capital Goods',
  'Healthcare',
  'Telecommunication',
  'Power',
  'Consumer Services',
  'Consumer Durables',
]);

const SessionModeSchema = z.enum(['nse-hours', 'extended', 'frozen']);

const meta = {
  asOf: istIso,
  simulated: z.literal(true),
};

const sumsTo100 = (values: number[]) => Math.abs(values.reduce((s, v) => s + v, 0) - 100) < 0.01;

const CurrencySchema = z.enum(['INR', 'USD']);

const AssetClassSchema = z.enum(['Equity', 'Fixed Income', 'Gold', 'REITs & InvITs', 'Cash']);

export const PortfolioSchema = z.object({
  portfolioId: z.string().min(1),
  name: z.string().min(1),
  aum: price,
  dailyPnL: finite,
  dailyPnLPercent: pct,
  mtdReturn: finite,
  ytdReturn: finite,
  sharpeRatio: finite,
  benchmark: z.string().min(1),
  lastUpdated: istIso,
}) satisfies z.ZodType<Portfolio>;

/** portfolio/summary: the Portfolio plus intraday and NAV detail used by the overview. */
export const SummarySchema = PortfolioSchema.extend({
  ...meta,
  sessionMode: SessionModeSchema,
  aumUsd: price,
  fxUsdInr: price,
  navPerUnit: price,
  navDayChangePct: pct,
  /** Intraday market value (holdings at live prices + other assets), INR. */
  marketValueInr: price,
  benchmarkDayChangePct: pct,
  oneYearReturnPct: finite,
  holdingsCount: z.number().int().positive(),
  equityWeightPct: pct,
  cashWeightPct: pct,
});

export const NavHistorySchema = z.object({
  ...meta,
  inceptionDate: dateKey,
  points: z.array(z.object({ date: dateKey, nav: price, benchmark: price })).min(2),
});

export const AllocationSchema = z.object({
  ...meta,
  totalInr: price,
  assetClasses: z
    .array(
      z.object({
        id: z.enum(['equity', 'debt', 'gold', 'reits', 'cash']),
        label: z.string(),
        valueInr: nonNegative,
        weightPct: pct,
      }),
    )
    .refine((rows) => sumsTo100(rows.map((r) => r.weightPct)), 'Asset classes must sum to 100%'),
  sectors: z
    .array(
      z.object({
        sector: SectorSchema,
        valueInr: nonNegative,
        weightPct: pct,
        portfolioWeightPct: pct,
      }),
    )
    .refine((rows) => sumsTo100(rows.map((r) => r.weightPct)), 'Sector weights must sum to 100%'),
});

export const HoldingSchema = z.object({
  holdingId: z.string().min(1),
  ticker: z.string().min(1),
  name: z.string().min(1),
  sector: SectorSchema,
  assetClass: AssetClassSchema,
  quantity: z.number().int().positive(),
  averageCost: price,
  currentPrice: price,
  marketValue: price,
  dailyPnL: finite,
  dailyPnLPercent: pct,
  weight: pct,
  currency: CurrencySchema,
}) satisfies z.ZodType<Holding>;

export const HoldingsSchema = z.object({
  ...meta,
  totalMarketValue: price,
  holdings: z
    .array(HoldingSchema)
    .refine(
      (rows) => rows.length === 0 || sumsTo100(rows.map((r) => r.weight)),
      'Holding weights must sum to 100%',
    ),
});

export const SectorReturnsSchema = z.object({
  ...meta,
  columns: z.array(z.object({ key: z.string(), label: z.string(), intraday: z.boolean() })),
  sectors: z.array(SectorSchema),
  cells: z.array(
    z.object({ sector: SectorSchema, column: z.string(), returnPct: pct, weightPct: pct }),
  ),
});

export const VarSchema = z.object({
  ...meta,
  lookbackDays: z.number().int().positive(),
  horizonDays: z.literal(1),
  portfolioValueInr: price,
  portfolioValueUsd: price,
  historical: z.object({
    var95: fraction,
    var99: fraction,
    cvar95: fraction,
    cvar99: fraction,
  }),
  parametric: z.object({ var95: fraction, var99: fraction }),
  meanDailyReturn: fraction,
  stdevDailyReturn: fraction,
  worstDay: z.object({ date: dateKey, returnPct: pct }),
  histogram: z.array(z.object({ from: fraction, to: fraction, count: z.number().int().min(0) })),
  assumptions: z.array(z.string()),
});

export const MetricsSchema = z.object({
  ...meta,
  riskFreeRate: z.number().min(0.065).max(0.07),
  periodStart: dateKey,
  cagr: finite,
  annualVolatility: nonNegative,
  sharpe: finite,
  sortino: finite,
  maxDrawdown: z.number().min(0).max(1),
  drawdownPeakDate: dateKey,
  drawdownTroughDate: dateKey,
  drawdownRecoveryDate: dateKey.nullable(),
  currentDrawdown: z.number().min(0).max(1),
  beta: finite,
  trackingError: nonNegative,
  informationRatio: finite,
  calmar: finite,
  oneYear: z.object({ sharpe: finite, volatility: nonNegative, returnPct: finite }),
});

export const AttributionPeriodSchema = z.enum(['1M', '3M', '6M', '1Y']);

export const AttributionRowSchema = z.object({
  sector: SectorSchema,
  portfolioWeightPct: pct,
  benchmarkWeightPct: pct,
  portfolioReturnPct: finite,
  benchmarkReturnPct: finite,
  allocationPct: finite,
  selectionPct: finite,
  totalPct: finite,
});

export const AttributionSchema = z.object({
  ...meta,
  periods: z.array(
    z.object({
      period: AttributionPeriodSchema,
      startDate: dateKey,
      endDate: dateKey,
      portfolioReturnPct: finite,
      benchmarkReturnPct: finite,
      rows: z.array(AttributionRowSchema),
    }),
  ),
  methodology: z.string(),
});

export const TradeSchema = z.object({
  id: z.string(),
  tradeDate: dateKey,
  time: istIso,
  symbol: z.string(),
  name: z.string(),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().int().positive(),
  price,
  valueInr: price,
  settlementDate: dateKey,
  status: z.enum(['Filled', 'Settling', 'Settled']),
  venue: z.literal('NSE'),
});

export const TradesSchema = z.object({
  ...meta,
  tradeDate: dateKey,
  trades: z.array(TradeSchema),
});

export const NewsArticleSchema = z.object({
  articleId: z.string().min(1),
  headline: z.string().min(1),
  summary: z.string(),
  source: z.string().min(1),
  publishedAt: istIso,
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  sentimentScore: z.number().finite().min(-1).max(1),
  relevantTickers: z.array(z.string().min(1)),
  category: z.enum(['earnings', 'macro', 'sector', 'rating', 'flows']),
}) satisfies z.ZodType<NewsArticle>;

export const ResearchSchema = z.object({
  ...meta,
  disclaimer: z.string(),
  articles: z.array(NewsArticleSchema),
});

export const AlertSchema = z.object({
  alertId: z.string().min(1),
  type: z.enum(['price_breach', 'risk_limit', 'news_event', 'rebalance_signal']),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string().min(1),
  triggeredAt: istIso,
  relatedWidget: z.string().min(1),
  relatedEntity: z.string().min(1),
  acknowledged: z.boolean(),
}) satisfies z.ZodType<Alert>;

export const AlertsSchema = z.object({
  ...meta,
  alerts: z.array(AlertSchema),
});

export type SummaryData = z.infer<typeof SummarySchema>;
export type NavHistoryData = z.infer<typeof NavHistorySchema>;
export type AllocationData = z.infer<typeof AllocationSchema>;
export type HoldingsData = z.infer<typeof HoldingsSchema>;
export type SectorReturnsData = z.infer<typeof SectorReturnsSchema>;
export type VarData = z.infer<typeof VarSchema>;
export type MetricsData = z.infer<typeof MetricsSchema>;
export type AttributionPeriod = z.infer<typeof AttributionPeriodSchema>;
export type AttributionRow = z.infer<typeof AttributionRowSchema>;
export type AttributionData = z.infer<typeof AttributionSchema>;
export type Trade = z.infer<typeof TradeSchema>;
export type TradesData = z.infer<typeof TradesSchema>;
export type ResearchData = z.infer<typeof ResearchSchema>;
export type AlertsData = z.infer<typeof AlertsSchema>;
