/**
 * Small constants shared by the client (main bundle) and the simulated back end. Kept apart so
 * importing one does not pull the portfolio model or the derivations into the main bundle.
 */
/** The demo fund's id (the only portfolio the mock API serves). */
export const PORTFOLIO_ID = 'MER-IMAF-01';

export const AUM_USD = 45_000_000_000;

/** Outlet labels on the simulated news (labels only; see ASSUMPTIONS §16). */
export const NEWS_SOURCES = ['Reuters', 'Bloomberg', 'Economic Times', 'Moneycontrol'] as const;

/** Risk limits used by the rule engine. Illustrative policy values. */
export const LIMITS = {
  var99Warning: 0.015,
  var99Critical: 0.02,
  singleNameWeightPct: 9,
  priceMovePct: 2.5,
  drawdownWarning: 0.05,
  /** |sentimentScore| at or above which research on a held ticker raises a news alert. */
  newsSentiment: 0.8,
  /** Most recent qualifying news alerts kept. */
  newsAlerts: 3,
} as const;

/** relatedEntity for fund-level alerts. */
export const PORTFOLIO_ENTITY = 'PORTFOLIO';

export const ASSET_CLASSES = ['Equity', 'Fixed Income', 'Derivatives', 'Alternatives'] as const;
export type MockAssetClass = (typeof ASSET_CLASSES)[number];

export const GEOGRAPHIES = ['India', 'US', 'UK', 'Singapore'] as const;
export type Geography = (typeof GEOGRAPHIES)[number];

export const INSTRUMENT_TYPES = [
  'Stock',
  'ADR',
  'GDR',
  'Government Bond',
  'Corporate Bond',
  'Treasury Bill',
  'Index Future',
  'Index Option',
  'REIT',
  'ETF',
  'Fund',
  'Cash',
] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

export const BENCHMARK_IDS = [
  'NIFTY50',
  'SENSEX',
  'SPX',
  'NIFTYBANK',
  'NIFTYIT',
  'NIFTYPHARMA',
] as const;
export type BenchmarkId = (typeof BENCHMARK_IDS)[number];
