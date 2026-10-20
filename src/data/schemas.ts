import { z } from 'zod';

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

export const SummarySchema = z.object({
  ...meta,
  sessionMode: SessionModeSchema,
  aumUsd: price,
  aumInr: price,
  fxUsdInr: price,
  navPerUnit: price,
  navDayChangePct: pct,
  marketValueInr: price,
  dayPnlInr: finite,
  dayChangePct: pct,
  benchmarkDayChangePct: pct,
  mtdReturnPct: finite,
  ytdReturnPct: finite,
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
  symbol: z.string().min(1),
  name: z.string().min(1),
  sector: SectorSchema,
  quantity: z.number().int().positive(),
  avgCost: price,
  ltp: price,
  prevClose: price,
  marketValueInr: price,
  weightPct: pct,
  dayChangePct: pct,
  dayPnlInr: finite,
  unrealisedPnlInr: finite,
  unrealisedPnlPct: finite,
});

export const HoldingsSchema = z.object({
  ...meta,
  totalMarketValueInr: price,
  holdings: z
    .array(HoldingSchema)
    .refine(
      (rows) => rows.length === 0 || sumsTo100(rows.map((r) => r.weightPct)),
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

export const ResearchItemSchema = z.object({
  id: z.string(),
  publishedAt: istIso,
  headline: z.string().min(1),
  summary: z.string(),
  symbol: z.string().nullable(),
  sector: SectorSchema.nullable(),
  sentiment: z.enum(['Positive', 'Neutral', 'Negative']),
  category: z.enum(['Earnings', 'Macro', 'Sector', 'Rating', 'Flows']),
  analyst: z.string(),
});

export const ResearchSchema = z.object({
  ...meta,
  disclaimer: z.string(),
  items: z.array(ResearchItemSchema),
});

export const AlertSchema = z.object({
  id: z.string(),
  severity: z.enum(['critical', 'warning', 'info']),
  source: z.enum(['Risk', 'Concentration', 'Price', 'Settlement', 'Drawdown']),
  title: z.string(),
  detail: z.string(),
  triggeredAt: istIso,
  symbol: z.string().nullable(),
});

export const AlertsSchema = z.object({
  ...meta,
  alerts: z.array(AlertSchema),
});

export type SummaryData = z.infer<typeof SummarySchema>;
export type NavHistoryData = z.infer<typeof NavHistorySchema>;
export type AllocationData = z.infer<typeof AllocationSchema>;
export type Holding = z.infer<typeof HoldingSchema>;
export type HoldingsData = z.infer<typeof HoldingsSchema>;
export type SectorReturnsData = z.infer<typeof SectorReturnsSchema>;
export type VarData = z.infer<typeof VarSchema>;
export type MetricsData = z.infer<typeof MetricsSchema>;
export type AttributionPeriod = z.infer<typeof AttributionPeriodSchema>;
export type AttributionRow = z.infer<typeof AttributionRowSchema>;
export type AttributionData = z.infer<typeof AttributionSchema>;
export type Trade = z.infer<typeof TradeSchema>;
export type TradesData = z.infer<typeof TradesSchema>;
export type ResearchItem = z.infer<typeof ResearchItemSchema>;
export type ResearchData = z.infer<typeof ResearchSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type AlertsData = z.infer<typeof AlertsSchema>;
