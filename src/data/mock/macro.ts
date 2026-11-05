import type { MarketHistory } from '../dataset';
import { createRng, hashSeed } from '../random';
import { gbmPath } from './gbm';

export const MACRO_IDS = ['FTSE', 'EURUSD', 'GOLD', 'CRUDE'] as const;
export type MacroId = (typeof MACRO_IDS)[number];

interface MacroSpec {
  id: MacroId;
  name: string;
  /** Latest close the series ends at: round, illustrative numbers, not quotes. */
  anchor: number;
  drift: number;
  volatility: number;
  /** Sensitivity to the simulated Nifty factor (global risk-on / risk-off). */
  beta: number;
  decimals: number;
}

export const MACRO_SPECS: readonly MacroSpec[] = [
  {
    id: 'FTSE',
    name: 'FTSE 100',
    anchor: 8_250,
    drift: 0.05,
    volatility: 0.13,
    beta: 0.3,
    decimals: 2,
  },
  {
    id: 'EURUSD',
    name: 'EUR/USD',
    anchor: 1.085,
    drift: 0,
    volatility: 0.07,
    beta: 0.05,
    decimals: 4,
  },
  {
    id: 'GOLD',
    name: 'Gold (USD/oz)',
    anchor: 2_650,
    drift: 0.06,
    volatility: 0.15,
    beta: -0.1,
    decimals: 2,
  },
  {
    id: 'CRUDE',
    name: 'Brent crude (USD/bbl)',
    anchor: 76,
    drift: 0,
    volatility: 0.32,
    beta: 0.25,
    decimals: 2,
  },
];

const cache = new WeakMap<MarketHistory, Record<MacroId, number[]>>();

/**
 * Daily closes for the ticker's non-Indian instruments, aligned with the market's dates: GBM
 * with a small beta to the simulated Nifty factor, seeded per market. Display only: nothing in
 * the book is valued with them.
 */
export function macroSeries(market: MarketHistory): Record<MacroId, number[]> {
  const hit = cache.get(market);
  if (hit) return hit;
  const build = (id: MacroId): number[] => {
    const spec = MACRO_SPECS.find((m) => m.id === id);
    if (!spec) return [];
    const rng = createRng(hashSeed(market.seed, market.asOfDate, 'macro', spec.id));
    return gbmPath(rng, market.benchmarkReturns.length, {
      drift: spec.drift,
      volatility: spec.volatility,
      endPrice: spec.anchor,
      factor: market.benchmarkReturns,
      beta: spec.beta,
    });
  };
  const out: Record<MacroId, number[]> = {
    FTSE: build('FTSE'),
    EURUSD: build('EURUSD'),
    GOLD: build('GOLD'),
    CRUDE: build('CRUDE'),
  };
  cache.set(market, out);
  return out;
}
