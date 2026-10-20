import { toIstIso } from '@/utils/time';
import { lastClose, previousClose, type Dataset, type HoldingStatic } from '../dataset';
import type { MarketSnapshot } from '../market';

/** Everything a derivation needs: the shared dataset plus the current simulated tape. */
export interface DeriveContext {
  dataset: Dataset;
  market: MarketSnapshot;
  nowMs: number;
}

export interface LiveHolding {
  holding: HoldingStatic;
  ltp: number;
  prevClose: number;
  marketValueInr: number;
  prevValueInr: number;
}

/** Live marks for every holding. Shared by holdings, allocation, summary and heat map. */
export function liveHoldings(ctx: DeriveContext): LiveHolding[] {
  const { dataset, market } = ctx;
  return dataset.holdings.map((holding) => {
    const i = holding.constituentIndex;
    const frozen = market.mode === 'frozen';
    const ltp = frozen ? lastClose(dataset, i) : (market.prices[i] ?? lastClose(dataset, i));
    const prevClose = frozen ? previousClose(dataset, i) : (market.referenceCloses[i] ?? ltp);
    return {
      holding,
      ltp,
      prevClose,
      marketValueInr: holding.quantity * ltp,
      prevValueInr: holding.quantity * prevClose,
    };
  });
}

export function nonEquityValueInr(dataset: Dataset): number {
  return dataset.assetClasses.filter((a) => a.id !== 'equity').reduce((s, a) => s + a.valueInr, 0);
}

export function asOfIso(ctx: DeriveContext): string {
  return toIstIso(ctx.market.asOfMs);
}

export const round = (value: number, digits = 4): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};
