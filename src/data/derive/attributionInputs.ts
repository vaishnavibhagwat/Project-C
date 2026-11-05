import type { AttributionInputsData } from '../schemas';
import { asOfIso, round, type DeriveContext } from './context';

/**
 * Trading days of daily inputs served: enough to reach back past the same month last year
 * (about 13 months) from any as-of day.
 */
export const ATTRIBUTION_INPUT_DAYS = 300;

/**
 * Illustrative policy benchmark for the asset-class view: 65% Nifty 50, 25% Indian government
 * bonds (the book's two GOI bonds, equally weighted), 10% gold (the gold ETF). Not a real
 * mandate's benchmark.
 */
export const POLICY_WEIGHTS = { Equity: 65, 'Fixed Income': 25, Alternatives: 10 } as const;

export const ATTRIBUTION_INPUTS_NOTE =
  'Brinson-Fachler on buy-and-hold weights at the start of each period (today’s quantities ' +
  'held constant, no cash flows). Sectors and factors: the equity sleeve against the Nifty 50 ' +
  '(index weights approximate). Asset classes: the whole book against an illustrative policy ' +
  'benchmark (65% Nifty 50, 25% GOI bonds, 10% gold); derivatives have no policy weight. ' +
  'Not a GIPS-compliant calculation.';

const cache = new WeakMap<DeriveContext['dataset'], Omit<AttributionInputsData, 'asOf'>>();

/**
 * performance/attribution-inputs: daily values and closes from which any window's Brinson
 * attribution can be computed in the browser (by sector, beta factor or asset class).
 */
export function deriveAttributionInputs(ctx: DeriveContext): AttributionInputsData {
  const { dataset } = ctx;
  const hit = cache.get(dataset);
  if (hit) return { asOf: asOfIso(ctx), ...hit };

  const n = Math.min(ATTRIBUTION_INPUT_DAYS, dataset.dates.length);
  const tail = (xs: readonly number[]) => xs.slice(-n);
  const betaBySymbol = new Map(dataset.constituents.map((c) => [c.symbol, c.beta]));

  const positions = dataset.positions.map((p) => {
    const fx = p.currency === 'USD' ? dataset.fxUsdInr : 1;
    return {
      key: p.id,
      ticker: p.ticker,
      name: p.name,
      assetClass: p.assetClass,
      sector: p.sector,
      beta: betaBySymbol.get(p.ticker) ?? null,
      values: tail(p.closes).map((c) => round(p.quantity * c * fx * p.valueFactor, 0)),
    };
  });

  const benchmark = dataset.constituents.map((c, i) => ({
    symbol: c.symbol,
    sector: c.sector,
    beta: c.beta,
    weightPct: round(c.indexWeight, 4),
    closes: tail(dataset.stockCloses[i] ?? []).map((v) => round(v, 2)),
  }));

  const normalised = (closes: readonly number[]) => {
    const first = closes[0] ?? 1;
    return closes.map((v) => v / first);
  };
  const govBonds = dataset.positions.filter(
    (p) => p.instrumentType === 'Government Bond' && p.currency === 'INR',
  );
  const bondLevels = tail(govBonds[0]?.closes ?? []).map(
    (_, t) =>
      govBonds.reduce((s, p) => s + (normalised(tail(p.closes))[t] ?? 1), 0) /
      Math.max(1, govBonds.length),
  );
  const gold = dataset.positions.find((p) => p.ticker === 'GOLDBEES');

  const body = {
    simulated: true as const,
    dates: dataset.dates.slice(-n),
    positions,
    benchmark,
    policy: {
      weightsPct: { ...POLICY_WEIGHTS },
      levels: {
        Equity: tail(dataset.benchmarkLevels).map((v) => round(v, 4)),
        'Fixed Income': bondLevels.map((v) => round(v * 100, 4)),
        Alternatives: normalised(tail(gold?.closes ?? [])).map((v) => round(v * 100, 4)),
      },
    },
    note: ATTRIBUTION_INPUTS_NOTE,
  };
  cache.set(dataset, body);
  return { asOf: asOfIso(ctx), ...body };
}
