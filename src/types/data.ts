/** Every mock API endpoint. All are derived from the one shared seeded dataset. */
export type EndpointId =
  | 'portfolio/summary'
  | 'portfolio/nav-history'
  | 'portfolio/allocation'
  | 'portfolio/holdings'
  | 'market/sector-returns'
  | 'market/ticker'
  | 'risk/var'
  | 'risk/metrics'
  | 'risk/returns'
  | 'performance/attribution'
  | 'performance/attribution-inputs'
  | 'performance/benchmarks'
  | 'trades/blotter'
  | 'research/feed'
  | 'market/news'
  | 'alerts/active'
  | 'alerts/panel';

export type Sector =
  | 'Financial Services'
  | 'Information Technology'
  | 'Oil, Gas & Fuels'
  | 'FMCG'
  | 'Automobile'
  | 'Metals & Mining'
  | 'Construction Materials'
  | 'Capital Goods'
  | 'Healthcare'
  | 'Telecommunication'
  | 'Power'
  | 'Consumer Services'
  | 'Consumer Durables';

export type NseSessionPhase = 'pre-open' | 'open' | 'closed';

export interface NseSessionStatus {
  phase: NseSessionPhase;
  /** Human-readable reason, e.g. "Weekend" or "Trading holiday". */
  label: string;
  /** Next transition time as an IST ISO string, when known. */
  nextChange: string | null;
}
