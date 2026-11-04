export * from './api';
export * from './connection';
export * from './dataset';
export * from './endpoints';
export * from './market';
export * from './nifty50';
export * from './random';
export * from './schemas';
export * from './transformers';
export type { DeriveContext } from './derive/context';
export { LIMITS } from './derive/alerts';
export { ATTRIBUTION_METHODOLOGY, ATTRIBUTION_PERIODS } from './derive/attribution';
export { RESEARCH_DISCLAIMER } from './derive/research';
export { VAR_ASSUMPTIONS, VAR_LOOKBACK_DAYS } from './derive/risk';
// The REST-style mock API (./mockApi), its generators (./mock) and the TanStack Query hooks
// over it (./queries: usePortfolio, useHoldings … useRealTimeData) are imported directly, not
// re-exported here, so the dashboard's main bundle does not carry code it does not use.
