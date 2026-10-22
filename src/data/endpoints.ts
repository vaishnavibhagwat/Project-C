import type { ZodType } from 'zod';
import type { EndpointId } from '@/types';
import type { DeriveContext } from './derive/context';
import { deriveAlerts } from './derive/alerts';
import { deriveAttribution } from './derive/attribution';
import {
  deriveAllocation,
  deriveHoldings,
  deriveNavHistory,
  deriveSectorReturns,
  deriveSummary,
} from './derive/portfolio';
import { deriveResearch } from './derive/research';
import { deriveMetrics, deriveVar } from './derive/risk';
import { deriveTrades } from './derive/trades';
import {
  AlertsSchema,
  AllocationSchema,
  AttributionSchema,
  HoldingsSchema,
  MetricsSchema,
  NavHistorySchema,
  ResearchSchema,
  SectorReturnsSchema,
  SummarySchema,
  TradesSchema,
  VarSchema,
  type AlertsData,
  type AllocationData,
  type AttributionData,
  type HoldingsData,
  type MetricsData,
  type NavHistoryData,
  type ResearchData,
  type SectorReturnsData,
  type SummaryData,
  type TradesData,
  type VarData,
} from './schemas';

export interface EndpointDataMap {
  'portfolio/summary': SummaryData;
  'portfolio/nav-history': NavHistoryData;
  'portfolio/allocation': AllocationData;
  'portfolio/holdings': HoldingsData;
  'market/sector-returns': SectorReturnsData;
  'risk/var': VarData;
  'risk/metrics': MetricsData;
  'performance/attribution': AttributionData;
  'trades/blotter': TradesData;
  'research/feed': ResearchData;
  'alerts/active': AlertsData;
}

export interface EndpointSpec<T> {
  schema: ZodType<T>;
  derive: (ctx: DeriveContext) => T;
  /** True when the response has nothing to show ("No data available"). */
  isEmpty: (data: T) => boolean;
}

type EndpointRegistry = { [K in EndpointId]: EndpointSpec<EndpointDataMap[K]> };

export const ENDPOINTS: EndpointRegistry = {
  'portfolio/summary': { schema: SummarySchema, derive: deriveSummary, isEmpty: () => false },
  'portfolio/nav-history': {
    schema: NavHistorySchema,
    derive: deriveNavHistory,
    isEmpty: (d) => d.points.length < 2,
  },
  'portfolio/allocation': {
    schema: AllocationSchema,
    derive: deriveAllocation,
    isEmpty: (d) => d.assetClasses.length === 0,
  },
  'portfolio/holdings': {
    schema: HoldingsSchema,
    derive: deriveHoldings,
    isEmpty: (d) => d.holdings.length === 0,
  },
  'market/sector-returns': {
    schema: SectorReturnsSchema,
    derive: deriveSectorReturns,
    isEmpty: (d) => d.cells.length === 0,
  },
  'risk/var': { schema: VarSchema, derive: deriveVar, isEmpty: (d) => d.lookbackDays === 0 },
  'risk/metrics': { schema: MetricsSchema, derive: deriveMetrics, isEmpty: () => false },
  'performance/attribution': {
    schema: AttributionSchema,
    derive: deriveAttribution,
    isEmpty: (d) => d.periods.length === 0,
  },
  'trades/blotter': {
    schema: TradesSchema,
    derive: deriveTrades,
    isEmpty: (d) => d.trades.length === 0,
  },
  'research/feed': {
    schema: ResearchSchema,
    derive: deriveResearch,
    isEmpty: (d) => d.articles.length === 0,
  },
  'alerts/active': {
    schema: AlertsSchema,
    derive: deriveAlerts,
    isEmpty: (d) => d.alerts.length === 0,
  },
};

export const ENDPOINT_IDS: readonly EndpointId[] = [
  'portfolio/summary',
  'portfolio/nav-history',
  'portfolio/allocation',
  'portfolio/holdings',
  'market/sector-returns',
  'risk/var',
  'risk/metrics',
  'performance/attribution',
  'trades/blotter',
  'research/feed',
  'alerts/active',
];
