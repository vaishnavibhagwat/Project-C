import type { Sector } from '@/types';
import { NIFTY50 } from '../nifty50';
import { createRng, hashSeed, normal, type Rng } from '../random';
import type { BenchmarkSeries } from './benchmarks';
import { blackScholes, gbmPath } from './gbm';
import { dailyReturns, windowCloses, type SeriesWindow } from './window';

export {
  ASSET_CLASSES,
  GEOGRAPHIES,
  INSTRUMENT_TYPES,
  type Geography,
  type InstrumentType,
  type MockAssetClass,
} from '../constants';
import type { Geography, InstrumentType, MockAssetClass } from '../constants';

/** Rate used for futures carry and option pricing (approximation: flat, annual). */
export const RISK_FREE_RATE_INR = 0.065;
/** Futures are carried at initial margin; their exposure is the full notional. */
export const FUTURES_MARGIN_RATE = 0.12;
export const NIFTY_LOT = 75;
export const BANK_NIFTY_LOT = 35;
/** Calendar days to expiry of the option positions on the as-of date. */
export const OPTION_DAYS_TO_EXPIRY = 45;
/** Share of AUM held as INR cash (margin and settlement buffer). */
export const CASH_WEIGHT = 0.005;

export interface Instrument {
  id: string;
  ticker: string;
  name: string;
  assetClass: MockAssetClass;
  instrumentType: InstrumentType;
  geography: Geography;
  exchange: string;
  currency: 'INR' | 'USD';
  sector: Sector | null;
  /** Units: shares, receipts, bonds (face 100), fund units or index units for derivatives. */
  quantity: number;
  /** Average cost per unit, local currency. */
  averageCost: number;
  /** Daily closes in local currency, oldest first, ending on the as-of date (≥ 2 values). */
  closes: number[];
  /** Share of notional carried as market value (futures: margin). 1 for everything else. */
  valueFactor: number;
  /** Economic exposure per unit relative to price: futures 1, options delta × spot / price. */
  exposurePerUnit: number;
}

interface Spec {
  id: string;
  ticker: string;
  name: string;
  assetClass: MockAssetClass;
  instrumentType: InstrumentType;
  geography: Geography;
  exchange: string;
  currency: 'INR' | 'USD';
  sector?: Sector | null;
  /** Target share of AUM. */
  weight: number;
  closes: number[];
  lot?: number;
  valueFactor?: number;
  exposurePerUnit?: number;
  /** Cost dispersion: average cost = last × exp(costBias + costSpread × Z). */
  costBias?: number;
  costSpread?: number;
}

/** Depositary receipts on simulated Nifty 50 names: price = underlying × ratio / FX × (1 + premium). */
const RECEIPTS = [
  {
    id: 'adr-infy',
    ticker: 'INFY US',
    underlying: 'INFY',
    ratio: 1,
    type: 'ADR',
    geo: 'US',
    exchange: 'NYSE',
    name: 'Infosys ADR',
    weight: 0.01,
  },
  {
    id: 'adr-hdb',
    ticker: 'HDB US',
    underlying: 'HDFCBANK',
    ratio: 3,
    type: 'ADR',
    geo: 'US',
    exchange: 'NYSE',
    name: 'HDFC Bank ADR',
    weight: 0.012,
  },
  {
    id: 'adr-ibn',
    ticker: 'IBN US',
    underlying: 'ICICIBANK',
    ratio: 2,
    type: 'ADR',
    geo: 'US',
    exchange: 'NYSE',
    name: 'ICICI Bank ADR',
    weight: 0.009,
  },
  {
    id: 'adr-wit',
    ticker: 'WIT US',
    underlying: 'WIPRO',
    ratio: 1,
    type: 'ADR',
    geo: 'US',
    exchange: 'NYSE',
    name: 'Wipro ADR',
    weight: 0.004,
  },
  {
    id: 'adr-rdy',
    ticker: 'RDY US',
    underlying: 'DRREDDY',
    ratio: 1,
    type: 'ADR',
    geo: 'US',
    exchange: 'NYSE',
    name: "Dr. Reddy's ADR",
    weight: 0.004,
  },
  {
    id: 'gdr-rigd',
    ticker: 'RIGD LI',
    underlying: 'RELIANCE',
    ratio: 2,
    type: 'GDR',
    geo: 'UK',
    exchange: 'LSE',
    name: 'Reliance Industries GDR',
    weight: 0.008,
  },
] as const;

/** Mean-reverting depositary-receipt premium (AR(1) around 3%), kept between −5% and +12%. */
function premiumPath(rng: Rng, length: number): number[] {
  const out: number[] = [];
  let p = 0.03;
  for (let t = 0; t < length; t += 1) {
    p = 0.03 + 0.92 * (p - 0.03) + 0.004 * normal(rng);
    out.push(Math.min(0.12, Math.max(-0.05, p)));
  }
  return out;
}

/** Annualised realised volatility of the `days` returns ending at return index `t` (exclusive). */
function realisedVolAt(returns: readonly number[], t: number, days: number): number {
  const window = returns.slice(Math.max(0, t - days), t);
  if (window.length < 2) return 0;
  const m = window.reduce((s, x) => s + x, 0) / window.length;
  const v = window.reduce((s, x) => s + (x - m) ** 2, 0) / (window.length - 1);
  return Math.sqrt(v * 252);
}

/**
 * Option price history for a position rolled at constant moneyness and tenor: on each day the
 * option is priced with the strike at the same distance from spot as today's strike, 45 days to
 * expiry and that day's 20-day realised volatility (floored). The last close is today's option.
 */
function optionCloses(
  kind: 'call' | 'put',
  index: readonly number[],
  strike: number,
  volatilityFloor: number,
): { closes: number[]; delta: number } {
  const spotLast = index[index.length - 1] ?? strike;
  const moneyness = strike / spotLast;
  const returns = dailyReturns(index);
  let delta = 0;
  const closes = index.map((spot, t) => {
    const point = blackScholes({
      kind,
      spot,
      strike: moneyness * spot,
      years: OPTION_DAYS_TO_EXPIRY / 365,
      rate: RISK_FREE_RATE_INR,
      volatility: Math.max(volatilityFloor, realisedVolAt(returns, t, 20)),
    });
    delta = point.delta;
    return Math.max(0.05, point.price);
  });
  return { closes, delta };
}

/**
 * The whole book: the shared dataset's Nifty 50 holdings (Indian equity), plus depositary
 * receipts, bonds, Nifty derivatives and alternatives sized from target weights of AUM. A
 * 91-day T-bill takes what is left, so the book adds up to the fund's AUM.
 */
export function buildInstruments(
  w: SeriesWindow,
  benchmarks: readonly BenchmarkSeries[],
): Instrument[] {
  const { dataset } = w;
  const rng = createRng(hashSeed(dataset.seed, dataset.asOfDate, 'mock-book'));
  const fx = dataset.fxUsdInr;
  const steps = w.dates.length - 1;
  const factor = w.marketReturns;
  const level = (id: string) => benchmarks.find((b) => b.id === id)?.levels ?? [];

  const equity: Instrument[] = dataset.holdings.map((h) => {
    const closes = windowCloses(w, h.constituentIndex);
    return {
      id: `eq-${h.symbol.toLowerCase()}`,
      ticker: h.symbol,
      name: h.name,
      assetClass: 'Equity',
      instrumentType: 'Stock',
      geography: 'India',
      exchange: 'NSE',
      currency: 'INR',
      sector: h.sector,
      quantity: h.quantity,
      averageCost: h.avgCost,
      closes,
      valueFactor: 1,
      exposurePerUnit: 1,
    };
  });

  const specs: Spec[] = [];
  for (const r of RECEIPTS) {
    const index = NIFTY50.findIndex((c) => c.symbol === r.underlying);
    const premium = premiumPath(rng, w.dates.length);
    const closes = windowCloses(w, index).map(
      (c, t) => ((c * r.ratio) / fx) * (1 + (premium[t] ?? 0)),
    );
    specs.push({
      id: r.id,
      ticker: r.ticker,
      name: r.name,
      assetClass: 'Equity',
      instrumentType: r.type,
      geography: r.geo,
      exchange: r.exchange,
      currency: 'USD',
      sector: NIFTY50[index]?.sector ?? null,
      weight: r.weight,
      closes,
    });
  }

  // Bond and T-bill closes are total-return prices: the drift is the coupon or yield, so
  // interest accrues in the price (no separate coupon cash flows).
  const bond = (drift: number, volatility: number, endPrice: number) =>
    gbmPath(rng, steps, { drift, volatility, endPrice });
  specs.push(
    {
      id: 'fi-goi-2033',
      ticker: 'GOI 7.18% 2033',
      name: 'Government of India 7.18% 2033',
      assetClass: 'Fixed Income',
      instrumentType: 'Government Bond',
      geography: 'India',
      exchange: 'NSE (RBI Retail Direct)',
      currency: 'INR',
      weight: 0.08,
      closes: bond(0.0718, 0.03, 101.2),
      costBias: -0.01,
      costSpread: 0.015,
    },
    {
      id: 'fi-goi-2034',
      ticker: 'GOI 7.10% 2034',
      name: 'Government of India 7.10% 2034',
      assetClass: 'Fixed Income',
      instrumentType: 'Government Bond',
      geography: 'India',
      exchange: 'NSE (RBI Retail Direct)',
      currency: 'INR',
      weight: 0.06,
      closes: bond(0.071, 0.035, 100.6),
      costBias: -0.008,
      costSpread: 0.015,
    },
    {
      id: 'fi-hdfcb-2033',
      ticker: 'HDFCBANK 7.80% 2033',
      name: 'HDFC Bank 7.80% Senior Bond 2033',
      assetClass: 'Fixed Income',
      instrumentType: 'Corporate Bond',
      geography: 'India',
      exchange: 'NSE (OTC)',
      currency: 'INR',
      sector: 'Financial Services',
      weight: 0.025,
      closes: bond(0.078, 0.025, 100.9),
      costBias: -0.005,
      costSpread: 0.01,
    },
    {
      id: 'fi-ust-2034',
      ticker: 'UST 4.25% 2034',
      name: 'US Treasury 4.25% 2034',
      assetClass: 'Fixed Income',
      instrumentType: 'Government Bond',
      geography: 'US',
      exchange: 'OTC',
      currency: 'USD',
      weight: 0.02,
      closes: bond(0.0425, 0.06, 97.8),
      costBias: 0.01,
      costSpread: 0.02,
    },
    {
      id: 'fi-temasek-2035',
      ticker: 'TEMASEK 2.25% 2035',
      name: 'Temasek Financial 2.25% USD Notes 2035',
      assetClass: 'Fixed Income',
      instrumentType: 'Corporate Bond',
      geography: 'Singapore',
      exchange: 'SGX',
      currency: 'USD',
      weight: 0.012,
      closes: bond(0.0225, 0.05, 92.4),
      costBias: 0.015,
      costSpread: 0.02,
    },
  );

  const nifty = level('NIFTY50');
  const bank = level('NIFTYBANK');
  const carry = Math.exp((RISK_FREE_RATE_INR * 30) / 365);
  const niftyLast = nifty[nifty.length - 1] ?? 1;
  const bankLast = bank[bank.length - 1] ?? 1;
  // A 5% out-of-the-money Nifty put (hedge) and a 3% out-of-the-money Nifty Bank call.
  const putStrike = Math.round((niftyLast * 0.95) / 50) * 50;
  const callStrike = Math.round((bankLast * 1.03) / 100) * 100;
  const put = optionCloses('put', nifty, putStrike, 0.11);
  const call = optionCloses('call', bank, callStrike, 0.13);
  const putLast = put.closes[put.closes.length - 1] ?? 1;
  const callLast = call.closes[call.closes.length - 1] ?? 1;
  specs.push(
    {
      id: 'drv-nifty-fut',
      ticker: 'NIFTY FUT',
      name: 'Nifty 50 Index Futures (near month)',
      assetClass: 'Derivatives',
      instrumentType: 'Index Future',
      geography: 'India',
      exchange: 'NSE F&O',
      currency: 'INR',
      weight: 0.05,
      lot: NIFTY_LOT,
      closes: nifty.map((l) => l * carry),
      valueFactor: FUTURES_MARGIN_RATE,
      exposurePerUnit: 1,
      costBias: -0.01,
      costSpread: 0.02,
    },
    {
      id: 'drv-nifty-put',
      ticker: `NIFTY ${putStrike} PE`,
      name: `Nifty 50 ${putStrike} Put (hedge)`,
      assetClass: 'Derivatives',
      instrumentType: 'Index Option',
      geography: 'India',
      exchange: 'NSE F&O',
      currency: 'INR',
      weight: 0.0035,
      lot: NIFTY_LOT,
      closes: put.closes,
      exposurePerUnit: (put.delta * niftyLast) / putLast,
      costBias: 0,
      costSpread: 0.2,
    },
    {
      id: 'drv-banknifty-call',
      ticker: `BANKNIFTY ${callStrike} CE`,
      name: `Nifty Bank ${callStrike} Call`,
      assetClass: 'Derivatives',
      instrumentType: 'Index Option',
      geography: 'India',
      exchange: 'NSE F&O',
      currency: 'INR',
      weight: 0.0015,
      lot: BANK_NIFTY_LOT,
      closes: call.closes,
      exposurePerUnit: (call.delta * bankLast) / callLast,
      costBias: 0,
      costSpread: 0.2,
    },
  );

  specs.push(
    {
      id: 'alt-goldbees',
      ticker: 'GOLDBEES',
      name: 'Nippon India ETF Gold BeES',
      assetClass: 'Alternatives',
      instrumentType: 'ETF',
      geography: 'India',
      exchange: 'NSE',
      currency: 'INR',
      weight: 0.04,
      closes: gbmPath(rng, steps, { drift: 0.1, volatility: 0.13, endPrice: 74.6 }),
    },
    {
      id: 'alt-embassy',
      ticker: 'EMBASSY',
      name: 'Embassy Office Parks REIT',
      assetClass: 'Alternatives',
      instrumentType: 'REIT',
      geography: 'India',
      exchange: 'NSE',
      currency: 'INR',
      weight: 0.014,
      closes: gbmPath(rng, steps, {
        drift: 0.06,
        volatility: 0.14,
        endPrice: 376.4,
        factor,
        beta: 0.3,
      }),
    },
    {
      id: 'alt-mindspace',
      ticker: 'MINDSPACE',
      name: 'Mindspace Business Parks REIT',
      assetClass: 'Alternatives',
      instrumentType: 'REIT',
      geography: 'India',
      exchange: 'NSE',
      currency: 'INR',
      weight: 0.011,
      closes: gbmPath(rng, steps, {
        drift: 0.07,
        volatility: 0.15,
        endPrice: 368.9,
        factor,
        beta: 0.3,
      }),
    },
    {
      id: 'alt-asia-growth',
      ticker: 'MAGF SG',
      name: 'Meridian Asia Growth Fund (Singapore VCC)',
      assetClass: 'Alternatives',
      instrumentType: 'Fund',
      geography: 'Singapore',
      exchange: 'Private (monthly NAV)',
      currency: 'USD',
      weight: 0.015,
      closes: gbmPath(rng, steps, {
        drift: 0.09,
        volatility: 0.1,
        endPrice: 128.4,
        factor,
        beta: 0.2,
      }),
    },
  );

  const others: Instrument[] = specs.map((s) => {
    const last = s.closes[s.closes.length - 1] ?? 1;
    const valueFactor = s.valueFactor ?? 1;
    const unitValueInr = last * (s.currency === 'USD' ? fx : 1) * valueFactor;
    const lot = s.lot ?? 1;
    // Futures are sized by notional exposure; everything else by market value.
    const unitTarget =
      s.instrumentType === 'Index Future' ? unitValueInr / valueFactor : unitValueInr;
    const lots = Math.max(1, Math.round((s.weight * dataset.aumInr) / (unitTarget * lot)));
    const cost = last * Math.exp((s.costBias ?? -0.06) + (s.costSpread ?? 0.12) * normal(rng));
    return {
      id: s.id,
      ticker: s.ticker,
      name: s.name,
      assetClass: s.assetClass,
      instrumentType: s.instrumentType,
      geography: s.geography,
      exchange: s.exchange,
      currency: s.currency,
      sector: s.sector ?? null,
      quantity: lots * lot,
      averageCost: Math.round(Math.max(0.05, cost) * 100) / 100,
      closes: s.closes,
      valueFactor,
      exposurePerUnit: s.exposurePerUnit ?? 1,
    };
  });

  // Cash buffer (margin and settlement) and a 91-day T-bill (price per 100 face) take the rest
  // of AUM, so the book adds up to it to within one rupee.
  const tbillCloses = gbmPath(rng, steps, { drift: 0.065, volatility: 0.002, endPrice: 98.42 });
  const tbillLast = tbillCloses[tbillCloses.length - 1] ?? 98.42;
  const used = [...equity, ...others].reduce((s, i) => s + valueInr(i, fx), 0);
  const cashTarget = CASH_WEIGHT * dataset.aumInr;
  const tbillQuantity = Math.max(1, Math.floor((dataset.aumInr - used - cashTarget) / tbillLast));
  const tbill: Instrument = {
    id: 'fi-tbill-91d',
    ticker: 'T-BILL 91D',
    name: 'Government of India 91-day Treasury Bill',
    assetClass: 'Fixed Income',
    instrumentType: 'Treasury Bill',
    geography: 'India',
    exchange: 'NSE (RBI Retail Direct)',
    currency: 'INR',
    sector: null,
    quantity: tbillQuantity,
    averageCost: Math.round(tbillLast * 0.995 * 100) / 100,
    closes: tbillCloses,
    valueFactor: 1,
    exposurePerUnit: 1,
  };
  const cashQuantity = Math.max(1, Math.floor(dataset.aumInr - used - tbillQuantity * tbillLast));
  const cash: Instrument = {
    id: 'cash-inr',
    ticker: 'CASH INR',
    name: 'Cash and margin (INR)',
    assetClass: 'Fixed Income',
    instrumentType: 'Cash',
    geography: 'India',
    exchange: 'Custodian',
    currency: 'INR',
    sector: null,
    quantity: cashQuantity,
    averageCost: 1,
    closes: w.dates.map(() => 1),
    valueFactor: 1,
    exposurePerUnit: 1,
  };
  return [...equity, ...others, tbill, cash];
}

/** Market value in INR at a close (default: the latest). */
export function valueInr(i: Instrument, fx: number, closeIndex = i.closes.length - 1): number {
  const price = i.closes[closeIndex] ?? 0;
  return i.quantity * price * i.valueFactor * (i.currency === 'USD' ? fx : 1);
}

/** Economic exposure in INR at the latest close (futures: notional; options: delta-adjusted). */
export function exposureInr(i: Instrument, fx: number): number {
  const price = i.closes[i.closes.length - 1] ?? 0;
  return i.quantity * price * i.exposurePerUnit * (i.currency === 'USD' ? fx : 1);
}
