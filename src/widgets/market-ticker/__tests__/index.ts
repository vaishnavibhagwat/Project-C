import { fixture } from '@/__tests__/fixtures';
import { parseEndpoint } from '@/data/api';
import type { MarketTickerConfig } from '../types';

/** Deterministic, validated data for tests and stories (shared seeded portfolio model). */
export const fixtureData = () => fixture('market/ticker');

/** A non-default configuration used by the "configured" story and tests. */
export const configuredConfig: MarketTickerConfig = {
  showNIFTY50: true,
  showSENSEX: false,
  showSPX: true,
  showFTSE: false,
  showUSDINR: true,
  showEURUSD: false,
  showGOLD: true,
  showCRUDE: false,
  speed: 'slow',
};

/** A valid response with nothing to show: the widget renders its empty state. */
export const emptyData = () => {
  const base = fixture('market/ticker');
  return parseEndpoint('market/ticker', { ...base, quotes: [] });
};
