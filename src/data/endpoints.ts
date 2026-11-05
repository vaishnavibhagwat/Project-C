import type { EndpointId } from '@/types';
import type { DeriveContext } from './derive/context';
import { deriveAlertPanel, deriveAlerts } from './derive/alerts';
import { deriveAttribution } from './derive/attribution';
import { deriveAttributionInputs } from './derive/attributionInputs';
import {
  deriveAllocation,
  deriveHoldings,
  deriveNavHistory,
  derivePerformanceSeries,
  deriveSectorReturns,
  deriveSummary,
} from './derive/portfolio';
import { deriveMarketNews } from './derive/news';
import { deriveResearch } from './derive/research';
import { deriveReturnSeries } from './derive/returns';
import { deriveTicker } from './derive/ticker';
import { deriveMetrics, deriveVar } from './derive/risk';
import { deriveTrades } from './derive/trades';
import { ENDPOINT_SCHEMAS, type EndpointDataMap, type EndpointSchemaSpec } from './endpointSchemas';

export { ENDPOINT_IDS, ENDPOINT_SCHEMAS } from './endpointSchemas';
export type { EndpointDataMap } from './endpointSchemas';

/** Server side of the mock API: an endpoint's schema plus the derivation that answers it. */
export interface EndpointSpec<T> extends EndpointSchemaSpec<T> {
  derive: (ctx: DeriveContext) => T;
}

function spec<E extends EndpointId>(
  endpoint: E,
  derive: (ctx: DeriveContext) => EndpointDataMap[E],
): EndpointSpec<EndpointDataMap[E]> {
  return { ...ENDPOINT_SCHEMAS[endpoint], derive };
}

type EndpointRegistry = { [K in EndpointId]: EndpointSpec<EndpointDataMap[K]> };

export const ENDPOINTS: EndpointRegistry = {
  'portfolio/summary': spec('portfolio/summary', deriveSummary),
  'portfolio/nav-history': spec('portfolio/nav-history', deriveNavHistory),
  'portfolio/allocation': spec('portfolio/allocation', deriveAllocation),
  'portfolio/holdings': spec('portfolio/holdings', deriveHoldings),
  'market/sector-returns': spec('market/sector-returns', deriveSectorReturns),
  'market/ticker': spec('market/ticker', deriveTicker),
  'risk/var': spec('risk/var', deriveVar),
  'risk/metrics': spec('risk/metrics', deriveMetrics),
  'risk/returns': spec('risk/returns', deriveReturnSeries),
  'performance/attribution': spec('performance/attribution', deriveAttribution),
  'performance/attribution-inputs': spec('performance/attribution-inputs', deriveAttributionInputs),
  'performance/benchmarks': spec('performance/benchmarks', derivePerformanceSeries),
  'trades/blotter': spec('trades/blotter', deriveTrades),
  'research/feed': spec('research/feed', deriveResearch),
  'market/news': spec('market/news', deriveMarketNews),
  'alerts/active': spec('alerts/active', deriveAlerts),
  'alerts/panel': spec('alerts/panel', deriveAlertPanel),
};
