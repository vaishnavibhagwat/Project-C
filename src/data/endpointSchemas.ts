import type { ZodType } from 'zod';
import type { EndpointId } from '@/types';
import {
  AlertPanelSchema,
  ExposureSchema,
  HoldingHistorySchema,
  RiskContributionSchema,
  StressSchema,
  SymbolHistorySchema,
  AlertsSchema,
  AllocationSchema,
  AttributionInputsSchema,
  AttributionSchema,
  HoldingsSchema,
  MarketNewsSchema,
  MarketTickerSchema,
  MetricsSchema,
  NavHistorySchema,
  PerformanceSeriesSchema,
  ResearchSchema,
  ReturnSeriesSchema,
  SectorReturnsSchema,
  SummarySchema,
  TradesSchema,
  VarSchema,
  type AlertPanelData,
  type ExposureData,
  type HoldingHistoryData,
  type RiskContributionData,
  type StressData,
  type SymbolHistoryData,
  type AlertsData,
  type AllocationData,
  type AttributionData,
  type AttributionInputsData,
  type HoldingsData,
  type MarketNewsData,
  type MarketTickerData,
  type MetricsData,
  type NavHistoryData,
  type PerformanceSeriesData,
  type ResearchData,
  type ReturnSeriesData,
  type SectorReturnsData,
  type SummaryData,
  type TradesData,
  type VarData,
} from './schemas';

/**
 * Client side of the mock API: each endpoint's response type, zod schema and "empty" test.
 * The derivations that produce the responses live in ./endpoints and ./server, which load as a
 * separate chunk on the first request (as a real server's code would never ship to the browser).
 */
export interface EndpointDataMap {
  'portfolio/summary': SummaryData;
  'portfolio/nav-history': NavHistoryData;
  'portfolio/allocation': AllocationData;
  'portfolio/holdings': HoldingsData;
  'market/sector-returns': SectorReturnsData;
  'market/ticker': MarketTickerData;
  'risk/var': VarData;
  'risk/metrics': MetricsData;
  'risk/returns': ReturnSeriesData;
  'risk/exposure': ExposureData;
  'risk/stress': StressData;
  'risk/contributions': RiskContributionData;
  'portfolio/holding-history': HoldingHistoryData;
  'market/symbol-history': SymbolHistoryData;
  'performance/attribution': AttributionData;
  'performance/attribution-inputs': AttributionInputsData;
  'performance/benchmarks': PerformanceSeriesData;
  'trades/blotter': TradesData;
  'research/feed': ResearchData;
  'market/news': MarketNewsData;
  'alerts/active': AlertsData;
  'alerts/panel': AlertPanelData;
}

export interface EndpointSchemaSpec<T> {
  schema: ZodType<T>;
  /** True when the response has nothing to show ("No data available"). */
  isEmpty: (data: T) => boolean;
}

type SchemaRegistry = { [K in EndpointId]: EndpointSchemaSpec<EndpointDataMap[K]> };

export const ENDPOINT_SCHEMAS: SchemaRegistry = {
  'portfolio/summary': { schema: SummarySchema, isEmpty: () => false },
  'portfolio/nav-history': {
    schema: NavHistorySchema,
    isEmpty: (d) => d.points.length < 2,
  },
  'portfolio/allocation': {
    schema: AllocationSchema,
    isEmpty: (d) => d.assetClasses.length === 0,
  },
  'portfolio/holdings': {
    schema: HoldingsSchema,
    isEmpty: (d) => d.holdings.length === 0,
  },
  'market/sector-returns': {
    schema: SectorReturnsSchema,
    isEmpty: (d) => d.cells.length === 0,
  },
  'market/ticker': {
    schema: MarketTickerSchema,
    isEmpty: (d) => d.quotes.length === 0,
  },
  'risk/var': { schema: VarSchema, isEmpty: (d) => d.lookbackDays === 0 },
  'risk/metrics': { schema: MetricsSchema, isEmpty: () => false },
  'risk/exposure': { schema: ExposureSchema, isEmpty: (d) => d.positions.length === 0 },
  'risk/stress': { schema: StressSchema, isEmpty: (d) => d.scenarios.length === 0 },
  'risk/contributions': {
    schema: RiskContributionSchema,
    isEmpty: (d) => d.positions.length === 0 || d.portfolioSigmaInr === 0,
  },
  'market/symbol-history': {
    schema: SymbolHistorySchema,
    isEmpty: (d) => d.symbols.length === 0,
  },
  'portfolio/holding-history': {
    schema: HoldingHistorySchema,
    isEmpty: (d) => d.holdings.length === 0,
  },
  'risk/returns': {
    schema: ReturnSeriesSchema,
    isEmpty: (d) => d.dates.length < 2,
  },
  'performance/attribution': {
    schema: AttributionSchema,
    isEmpty: (d) => d.periods.length === 0,
  },
  'performance/attribution-inputs': {
    schema: AttributionInputsSchema,
    isEmpty: (d) => d.dates.length < 2,
  },
  'performance/benchmarks': {
    schema: PerformanceSeriesSchema,
    isEmpty: (d) => d.dates.length < 2,
  },
  'trades/blotter': {
    schema: TradesSchema,
    isEmpty: (d) => d.trades.length === 0,
  },
  'research/feed': {
    schema: ResearchSchema,
    isEmpty: (d) => d.articles.length === 0,
  },
  'market/news': {
    schema: MarketNewsSchema,
    isEmpty: (d) => d.articles.length === 0,
  },
  'alerts/active': {
    schema: AlertsSchema,
    isEmpty: (d) => d.alerts.length === 0,
  },
  'alerts/panel': {
    schema: AlertPanelSchema,
    // Rules can still fire with no active alerts, so an empty list is not "no data".
    isEmpty: () => false,
  },
};

export const ENDPOINT_IDS: readonly EndpointId[] = [
  'portfolio/summary',
  'portfolio/nav-history',
  'portfolio/allocation',
  'portfolio/holdings',
  'market/sector-returns',
  'market/ticker',
  'risk/var',
  'risk/metrics',
  'risk/returns',
  'risk/exposure',
  'risk/stress',
  'risk/contributions',
  'portfolio/holding-history',
  'market/symbol-history',
  'performance/attribution',
  'performance/attribution-inputs',
  'performance/benchmarks',
  'trades/blotter',
  'research/feed',
  'market/news',
  'alerts/active',
  'alerts/panel',
];
