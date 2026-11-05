import { z } from 'zod';
import type { Alert, Holding, NewsArticle, Portfolio } from '@/types';
import { BENCHMARK_IDS } from './mock/benchmarks';
import { ASSET_CLASSES, GEOGRAPHIES, INSTRUMENT_TYPES } from './mock/instruments';

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

export const SectorSchema = z.enum([
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

const AssetClassSchema = z.enum(ASSET_CLASSES);
const GeographySchema = z.enum(GEOGRAPHIES);

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
  /** Zero for a fund with no positions yet (the overview then shows its empty state). */
  holdingsCount: z.number().int().nonnegative(),
  /** Equity asset class (stocks and depositary receipts), percent of market value. */
  equityWeightPct: pct,
  /** T-bill and cash, percent of market value. */
  cashWeightPct: pct,
});

export const NavHistorySchema = z.object({
  ...meta,
  inceptionDate: dateKey,
  /** Fewer than two points means there is no history to chart (the widgets show empty). */
  points: z.array(z.object({ date: dateKey, nav: price, benchmark: price })),
});

/**
 * performance/benchmarks: the fund NAV and six simulated index series on the same trading
 * days, in their own units (each widget rebases them).
 */
export const PerformanceSeriesSchema = z
  .object({
    ...meta,
    inceptionDate: dateKey,
    dates: z.array(dateKey),
    fund: z.array(price),
    benchmarks: z.array(
      z.object({
        id: z.enum(BENCHMARK_IDS),
        name: z.string().min(1),
        currency: CurrencySchema,
        levels: z.array(price),
      }),
    ),
  })
  .refine(
    (d) =>
      d.fund.length === d.dates.length &&
      d.benchmarks.every((b) => b.levels.length === d.dates.length),
    'Every series needs one value per date',
  );

const ReturnSeriesItemSchema = z.object({
  key: z.string().min(1),
  /** Short label (ticker or sector). */
  label: z.string().min(1),
  name: z.string().min(1),
  /** Share of the book, percent. */
  weightPct: pct,
  /** Daily simple returns (fractions), one per date. */
  returns: z.array(z.number().finite().min(-1)),
});

/** risk/returns: daily returns of the largest holdings and of each equity sector. */
export const ReturnSeriesSchema = z
  .object({
    ...meta,
    /** Trading day of each return (the close it runs to), oldest first. */
    dates: z.array(dateKey),
    holdings: z.array(ReturnSeriesItemSchema),
    sectors: z.array(ReturnSeriesItemSchema),
  })
  .refine(
    (d) => [...d.holdings, ...d.sectors].every((s) => s.returns.length === d.dates.length),
    'Every series needs one return per date',
  );

const levelSeries = z.array(z.number().finite().nonnegative());

/** performance/attribution-inputs: daily inputs for in-browser Brinson attribution. */
export const AttributionInputsSchema = z
  .object({
    ...meta,
    dates: z.array(dateKey),
    positions: z.array(
      z.object({
        key: z.string().min(1),
        ticker: z.string().min(1),
        name: z.string().min(1),
        assetClass: AssetClassSchema,
        sector: SectorSchema.nullable(),
        /** Beta to the market factor (NSE-listed stocks only). */
        beta: z.number().finite().nullable(),
        /** Value in INR on each date at today's quantity. */
        values: levelSeries,
      }),
    ),
    benchmark: z.array(
      z.object({
        symbol: z.string().min(1),
        sector: SectorSchema,
        beta: z.number().finite(),
        weightPct: pct,
        closes: levelSeries,
      }),
    ),
    policy: z.object({
      weightsPct: z.object({ Equity: pct, 'Fixed Income': pct, Alternatives: pct }),
      levels: z.object({
        Equity: levelSeries,
        'Fixed Income': levelSeries,
        Alternatives: levelSeries,
      }),
    }),
    note: z.string(),
  })
  .refine(
    (d) =>
      [
        ...d.positions.map((p) => p.values),
        ...d.benchmark.map((b) => b.closes),
        d.policy.levels.Equity,
        d.policy.levels['Fixed Income'],
        d.policy.levels.Alternatives,
      ].every((s) => s.length === d.dates.length),
    'Every series needs one value per date',
  );

/** market/ticker: index, FX and commodity quotes for the ticker widget. */
export const MarketTickerSchema = z.object({
  ...meta,
  quotes: z.array(
    z.object({
      symbol: z.string().min(1),
      name: z.string().min(1),
      price,
      previousClose: price,
      changePct: finite,
      decimals: z.number().int().min(0).max(6),
      /** True while the value moves with the simulated NSE tape. */
      live: z.boolean(),
      /** Where the value comes from (live tape, last close, fixed rate). */
      note: z.string(),
      /** Recent daily closes (and today's live value), oldest first. */
      history: z.array(price),
    }),
  ),
});

export const AllocationSchema = z.object({
  ...meta,
  totalInr: price,
  assetClasses: z
    .array(
      z.object({
        id: z.enum(['equity', 'fixed-income', 'derivatives', 'alternatives']),
        label: AssetClassSchema,
        valueInr: nonNegative,
        weightPct: pct,
      }),
    )
    .refine(
      (rows) => rows.length === 0 || sumsTo100(rows.map((r) => r.weightPct)),
      'Asset classes must sum to 100%',
    ),
  geographies: z
    .array(z.object({ geography: GeographySchema, valueInr: nonNegative, weightPct: pct }))
    .refine(
      (rows) => rows.length === 0 || sumsTo100(rows.map((r) => r.weightPct)),
      'Geographies must sum to 100%',
    ),
  /** Equity asset class by sector: weightPct within equity, portfolioWeightPct of the book. */
  sectors: z
    .array(
      z.object({
        sector: SectorSchema,
        valueInr: nonNegative,
        weightPct: pct,
        portfolioWeightPct: pct,
      }),
    )
    .refine(
      (rows) => rows.length === 0 || sumsTo100(rows.map((r) => r.weightPct)),
      'Sector weights must sum to 100%',
    ),
});

export const HoldingSchema = z.object({
  holdingId: z.string().min(1),
  ticker: z.string().min(1),
  name: z.string().min(1),
  sector: SectorSchema.nullable(),
  assetClass: AssetClassSchema,
  instrumentType: z.enum(INSTRUMENT_TYPES),
  geography: GeographySchema,
  quantity: z.number().int().positive(),
  averageCost: price,
  currentPrice: price,
  marketValue: price,
  dailyPnL: finite,
  dailyPnLPercent: pct,
  unrealisedPnL: finite,
  costBasis: price,
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
  /** Zero when there is no return history yet (the gauge shows its empty state). */
  lookbackDays: z.number().int().nonnegative(),
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
  /**
   * VaR on each of the last 30 trading days (oldest first), each from the 252 returns ending
   * that day: the band of recent values the gauge shows.
   */
  history: z.array(
    z.object({
      date: dateKey,
      historical: z.object({ var95: fraction, var99: fraction }),
      parametric: z.object({ var95: fraction, var99: fraction }),
    }),
  ),
  assumptions: z.array(z.string()),
});

export const MetricsSchema = z.object({
  ...meta,
  riskFreeRate: z.number().min(0.065).max(0.07),
  periodStart: dateKey,
  /** Daily returns the metrics were computed from; under 2 means there is nothing to show. */
  observations: z.number().int().nonnegative(),
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

/** market/news: simulated outlet-labelled stories (daily post-close plus the intraday wire). */
export const MarketNewsSchema = z.object({
  ...meta,
  disclaimer: z.string(),
  /** Outlet labels the feed uses (for the source filter). */
  sources: z.array(z.string().min(1)),
  articles: z.array(NewsArticleSchema),
});

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

/**
 * alerts/panel: the active alerts plus the inputs the Alert Panel's own rules check (prices,
 * VaR and drawdown at the same moment), so rules and alerts agree.
 */
export const AlertPanelSchema = z.object({
  ...meta,
  alerts: z.array(AlertSchema),
  inputs: z.object({
    quotes: z.array(
      z.object({
        ticker: z.string().min(1),
        name: z.string().min(1),
        price,
        currency: CurrencySchema,
      }),
    ),
    /** 1-day historical VaR, fractions of AUM. */
    var95: z.number().min(0).max(1),
    var99: z.number().min(0).max(1),
    /** Fraction below the NAV high-water mark. */
    currentDrawdown: z.number().min(0).max(1),
  }),
});

export const AlertsSchema = z.object({
  ...meta,
  alerts: z.array(AlertSchema),
});

export type SummaryData = z.infer<typeof SummarySchema>;
export type NavHistoryData = z.infer<typeof NavHistorySchema>;
export type MarketTickerData = z.infer<typeof MarketTickerSchema>;
export type AttributionInputsData = z.infer<typeof AttributionInputsSchema>;
export type ReturnSeriesData = z.infer<typeof ReturnSeriesSchema>;
export type PerformanceSeriesData = z.infer<typeof PerformanceSeriesSchema>;
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
export type MarketNewsData = z.infer<typeof MarketNewsSchema>;
export type AlertsData = z.infer<typeof AlertsSchema>;
export type AlertPanelData = z.infer<typeof AlertPanelSchema>;
