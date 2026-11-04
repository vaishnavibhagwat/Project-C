import { toIstIso } from '@/utils/time';
import type { MarketSnapshot } from '../market';
import {
  valueBook,
  type HoldingStatic,
  type PortfolioModel,
  type PositionValuation,
} from '../model';

/** Everything a derivation needs: the portfolio model plus the current simulated tape. */
export interface DeriveContext {
  dataset: PortfolioModel;
  market: MarketSnapshot;
  nowMs: number;
}

const bookCache = new WeakMap<
  MarketSnapshot,
  { model: PortfolioModel; rows: PositionValuation[] }
>();

/**
 * Every position of the model valued at the current marks, with weights. Shared by holdings,
 * allocation, summary, heat map and alerts, so their totals are the same numbers. Cached per
 * market snapshot (one tape tick), so endpoints read in the same tick share one valuation.
 */
export function liveBook(ctx: DeriveContext): PositionValuation[] {
  const hit = bookCache.get(ctx.market);
  if (hit?.model === ctx.dataset) return hit.rows;
  const rows = valueBook(ctx.dataset, ctx.market);
  bookCache.set(ctx.market, { model: ctx.dataset, rows });
  return rows;
}

export interface LiveHolding {
  holding: HoldingStatic;
  ltp: number;
  prevClose: number;
  marketValueInr: number;
  prevValueInr: number;
}

/** The NSE-listed stocks of the book at live marks (the equities that tick intraday). */
export function liveHoldings(ctx: DeriveContext): LiveHolding[] {
  const byIndex = new Map(
    liveBook(ctx).flatMap((r) => (r.constituentIndex === null ? [] : [[r.constituentIndex, r]])),
  );
  return ctx.dataset.holdings.flatMap((holding) => {
    const row = byIndex.get(holding.constituentIndex);
    if (!row) return [];
    return [
      {
        holding,
        ltp: row.price,
        prevClose: row.previousClose,
        marketValueInr: row.marketValueInr,
        prevValueInr: row.marketValueInr - row.dailyPnlInr,
      },
    ];
  });
}

export function asOfIso(ctx: DeriveContext): string {
  return toIstIso(ctx.market.asOfMs);
}

export const round = (value: number, digits = 4): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};
