/** Every mock API endpoint. All are derived from the one shared seeded dataset. */
export type EndpointId =
  | 'portfolio/summary'
  | 'portfolio/nav-history'
  | 'portfolio/allocation'
  | 'portfolio/holdings'
  | 'market/sector-returns'
  | 'risk/var'
  | 'risk/metrics'
  | 'performance/attribution'
  | 'trades/blotter'
  | 'research/feed'
  | 'alerts/active';

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
