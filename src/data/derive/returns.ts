import type { Position } from '../model';
import type { ReturnSeriesData } from '../schemas';
import { asOfIso, liveBook, round, type DeriveContext } from './context';

/** Daily returns served (one trading year); widgets slice shorter lookbacks from the end. */
export const RETURNS_LOOKBACK_DAYS = 252;
/** Largest holdings served. */
export const RETURN_SERIES_HOLDINGS = 15;

/** Instruments whose price barely moves (no meaningful correlation): left out. */
const FLAT_TYPES: readonly string[] = ['Cash', 'Treasury Bill'];

function simpleReturns(levels: readonly number[]): number[] {
  const out: number[] = [];
  for (let t = 1; t < levels.length; t += 1) {
    const prev = levels[t - 1] ?? 0;
    out.push(prev > 0 ? (levels[t] ?? prev) / prev - 1 : 0);
  }
  return out;
}

const cache = new WeakMap<DeriveContext['dataset'], Omit<ReturnSeriesData, 'asOf'>>();

/**
 * risk/returns: the last 252 daily close-to-close returns of the book's 15 largest holdings
 * (by weight, cash and T-bill excluded) and of each equity sector (value-weighted, today's
 * quantities held constant). All from the portfolio model, so they match every other widget.
 */
export function deriveReturnSeries(ctx: DeriveContext): ReturnSeriesData {
  const { dataset } = ctx;
  const hit = cache.get(dataset);
  if (hit) return { asOf: asOfIso(ctx), ...hit };

  const n = RETURNS_LOOKBACK_DAYS + 1;
  const tail = (xs: readonly number[]) => xs.slice(-n);
  const fx = (p: Position) => (p.currency === 'USD' ? dataset.fxUsdInr : 1);
  const pack = (xs: number[]) => xs.map((r) => round(r, 6));

  const book = liveBook(ctx);
  const holdings = book
    .filter((r) => !FLAT_TYPES.includes(r.position.instrumentType))
    .sort((a, b) => b.weightPct - a.weightPct)
    .slice(0, RETURN_SERIES_HOLDINGS)
    .map((r) => ({
      key: r.position.id,
      label: r.position.ticker,
      name: r.position.name,
      weightPct: round(r.weightPct, 4),
      returns: pack(simpleReturns(tail(r.position.closes))),
    }));

  const bySector = new Map<string, { value: number[]; weight: number }>();
  for (const r of book) {
    const p = r.position;
    if (p.assetClass !== 'Equity' || !p.sector) continue;
    const entry = bySector.get(p.sector) ?? { value: new Array<number>(n).fill(0), weight: 0 };
    tail(p.closes).forEach((c, t) => {
      entry.value[t] = (entry.value[t] ?? 0) + p.quantity * c * fx(p);
    });
    entry.weight += r.weightPct;
    bySector.set(p.sector, entry);
  }
  const sectors = [...bySector.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .map(([sector, s]) => ({
      key: sector,
      label: sector,
      name: sector,
      weightPct: round(s.weight, 4),
      returns: pack(simpleReturns(s.value)),
    }));

  const body = {
    simulated: true as const,
    dates: dataset.dates.slice(-RETURNS_LOOKBACK_DAYS),
    holdings,
    sectors,
  };
  cache.set(dataset, body);
  return { asOf: asOfIso(ctx), ...body };
}
