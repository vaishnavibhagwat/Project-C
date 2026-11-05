import { parseEndpoint } from '@/data/api';
import { fixture } from '@/__tests__/fixtures';
import type { TradeBlotterConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded dataset). */
export const fixtureData = () => fixture('trades/blotter');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: TradeBlotterConfig = {
  side: 'BUY',
  status: 'ALL',
  showSettlement: true,
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('trades/blotter');
  return parseEndpoint('trades/blotter', { ...base, trades: [] });
};
