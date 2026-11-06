import { mean } from '@/utils/finance';
import type { PositionValuation } from '../model';
import type {
  SymbolHistoryData,
  ExposureData,
  HoldingHistoryData,
  RiskContributionData,
  StressData,
} from '../schemas';
import { asOfIso, liveBook, round, type DeriveContext } from './context';

/** Daily closes per holding served for the detail drawer's sparkline. */
export const HOLDING_HISTORY_DAYS = 60;
/** Daily returns behind the risk contributions (as for VaR). */
export const CONTRIBUTION_LOOKBACK_DAYS = 252;

/** Depositary receipts take their underlying NSE stock's beta. */
const RECEIPT_UNDERLYING: Record<string, string> = {
  'INFY US': 'INFY',
  'HDB US': 'HDFCBANK',
  'IBN US': 'ICICIBANK',
  'WIT US': 'WIPRO',
  'RDY US': 'DRREDDY',
  'RIGD LI': 'RELIANCE',
};

/** Equity-shock beta per position (assumptions for non-stocks; see ASSUMPTIONS §21). */
function betaOf(ctx: DeriveContext, r: PositionValuation): number {
  const p = r.position;
  const byTicker = (t: string) => ctx.dataset.constituents.find((c) => c.symbol === t)?.beta;
  if (p.assetClass === 'Equity') return byTicker(RECEIPT_UNDERLYING[p.ticker] ?? p.ticker) ?? 1;
  if (p.instrumentType === 'Index Future' || p.instrumentType === 'Index Option') return 1;
  if (p.instrumentType === 'REIT') return 0.5;
  if (p.instrumentType === 'Fund') return 0.8;
  if (p.instrumentType === 'ETF') return -0.1; // gold
  return 0;
}

/**
 * Approximate modified duration of a bond from its ticker ("GOI 7.18% 2033"): a par bond
 * paying the coupon annually, D = (1 − (1 + y)^−n) / y with y = the coupon. T-bills 0.25.
 */
export function approxDuration(ticker: string, instrumentType: string, asOfYear: number): number {
  if (instrumentType === 'Treasury Bill') return 0.25;
  const coupon = Number(/(\d+(?:\.\d+)?)%/.exec(ticker)?.[1] ?? '7') / 100;
  const year = Number(/(20\d\d)/.exec(ticker)?.[1] ?? String(asOfYear + 5));
  const n = Math.max(0.5, year - asOfYear + 0.5);
  const y = Math.max(0.005, coupon);
  return (1 - (1 + y) ** -n) / y;
}

const isBond = (t: string) =>
  t === 'Government Bond' || t === 'Corporate Bond' || t === 'Treasury Bill';

/** risk/exposure: every position's market value and economic exposure (INR). */
export function deriveExposure(ctx: DeriveContext): ExposureData {
  const book = liveBook(ctx);
  return {
    asOf: asOfIso(ctx),
    simulated: true,
    totalMarketValueInr: round(
      book.reduce((s, r) => s + r.marketValueInr, 0),
      2,
    ),
    positions: book.map((r) => ({
      key: r.position.id,
      ticker: r.position.ticker,
      assetClass: r.position.assetClass,
      sector: r.position.sector,
      geography: r.position.geography,
      currency: r.position.currency,
      instrumentType: r.position.instrumentType,
      marketValueInr: round(r.marketValueInr, 2),
      // Futures at full notional, options delta-adjusted, the rest at market value.
      exposureInr: round(
        r.position.instrumentType === 'Index Future' || r.position.instrumentType === 'Index Option'
          ? r.exposureInr
          : r.marketValueInr,
        2,
      ),
    })),
  };
}

interface ScenarioSpec {
  id: string;
  name: string;
  description: string;
  shock: (ctx: DeriveContext, r: PositionValuation) => number;
}

const asOfYear = (ctx: DeriveContext) => Number(ctx.dataset.asOfDate.slice(0, 4));
const usdGain = (fall: number) => 1 / (1 - fall) - 1;

/** Stress scenarios: the INR P&L of each position under an instantaneous shock. */
const SCENARIOS: readonly ScenarioSpec[] = [
  {
    id: 'nifty-10',
    name: 'Nifty 50 −10%',
    description: 'Indian equities fall 10%: each equity-linked position moves by beta × −10%.',
    shock: (ctx, r) => r.exposureInr * betaOf(ctx, r) * -0.1,
  },
  {
    id: 'rates-100',
    name: 'Rates +100 bps',
    description:
      'Yields rise 1 percentage point: bonds move by −duration × 1%. Equities unchanged.',
    shock: (ctx, r) =>
      isBond(r.position.instrumentType)
        ? -r.marketValueInr *
          approxDuration(r.position.ticker, r.position.instrumentType, asOfYear(ctx)) *
          0.01
        : 0,
  },
  {
    id: 'inr-5',
    name: 'INR −5% vs USD',
    description: 'The rupee weakens 5%: USD positions gain about 5.3% in INR terms.',
    shock: (_, r) => (r.position.currency === 'USD' ? r.marketValueInr * usdGain(0.05) : 0),
  },
  {
    id: 'covid-2020',
    name: '2020 COVID replay',
    description:
      'Approximate 19 Feb – 23 Mar 2020 moves: Nifty 50 −38% (by beta), GOI bonds +2%, gold −1%, INR −6% vs USD.',
    shock: (ctx, r) => {
      const t = r.position.instrumentType;
      const fx = r.position.currency === 'USD' ? r.marketValueInr * usdGain(0.06) : 0;
      if (t === 'ETF') return r.marketValueInr * -0.01 + fx;
      if (t === 'Government Bond' && r.position.currency === 'INR') return r.marketValueInr * 0.02;
      if (isBond(t)) return fx;
      return r.exposureInr * betaOf(ctx, r) * -0.38 + fx;
    },
  },
];

/** risk/stress: estimated portfolio impact of each scenario, by asset class and position. */
export function deriveStress(ctx: DeriveContext): StressData {
  const book = liveBook(ctx);
  const total = book.reduce((s, r) => s + r.marketValueInr, 0);
  return {
    asOf: asOfIso(ctx),
    simulated: true,
    portfolioValueInr: round(total, 2),
    scenarios: SCENARIOS.map((sc) => {
      const impacts = book.map((r) => ({ r, impact: sc.shock(ctx, r) }));
      const impactInr = impacts.reduce((s, x) => s + x.impact, 0);
      const byClass = new Map<string, number>();
      for (const { r, impact } of impacts) {
        byClass.set(r.position.assetClass, (byClass.get(r.position.assetClass) ?? 0) + impact);
      }
      return {
        id: sc.id,
        name: sc.name,
        description: sc.description,
        impactInr: round(impactInr, 2),
        impactPct: round(total > 0 ? (impactInr / total) * 100 : 0, 4),
        byAssetClass: [...byClass.entries()]
          .filter(([, v]) => Math.abs(v) > 0.5)
          .map(([assetClass, v]) => ({ assetClass, impactInr: round(v, 2) })),
        largest: impacts
          .filter((x) => Math.abs(x.impact) > 0.5)
          .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
          .slice(0, 3)
          .map((x) => ({ ticker: x.r.position.ticker, impactInr: round(x.impact, 2) })),
      };
    }),
  };
}

/**
 * risk/contributions: Euler allocation of portfolio volatility (INR per day) to positions,
 * from the covariance of daily position P&L over 252 days at today's quantities. The
 * contributions sum to the portfolio's standard deviation; diversifiers are negative.
 */
export function deriveContributions(ctx: DeriveContext): RiskContributionData {
  const { dataset } = ctx;
  const book = liveBook(ctx);
  const n = CONTRIBUTION_LOOKBACK_DAYS;
  const pnl = book.map((r) => {
    const fx = r.position.currency === 'USD' ? dataset.fxUsdInr : 1;
    const closes = r.position.closes.slice(-(n + 1));
    const out: number[] = [];
    for (let t = 1; t < closes.length; t += 1) {
      out.push(r.position.quantity * ((closes[t] ?? 0) - (closes[t - 1] ?? 0)) * fx);
    }
    return out;
  });
  const days = Math.min(...pnl.map((x) => x.length));
  const port = Array.from({ length: days }, (_, t) => pnl.reduce((s, x) => s + (x[t] ?? 0), 0));
  const mp = mean(port);
  const cov = (xs: readonly number[]) => {
    const mx = mean(xs);
    let acc = 0;
    for (let t = 0; t < days; t += 1) acc += ((xs[t] ?? 0) - mx) * ((port[t] ?? 0) - mp);
    return acc / Math.max(1, days - 1);
  };
  const sigma = Math.sqrt(cov(port));
  const sd = (xs: readonly number[]) => {
    const mx = mean(xs);
    return Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) / Math.max(1, xs.length - 1));
  };
  return {
    asOf: asOfIso(ctx),
    simulated: true,
    lookbackDays: days,
    portfolioValueInr: round(
      book.reduce((s, r) => s + r.marketValueInr, 0),
      2,
    ),
    portfolioSigmaInr: round(sigma, 2),
    positions: book.map((r, i) => ({
      key: r.position.id,
      ticker: r.position.ticker,
      name: r.position.name,
      assetClass: r.position.assetClass,
      weightPct: round(r.weightPct, 4),
      contributionInr: round(sigma > 0 ? cov(pnl[i] ?? []) / sigma : 0, 2),
      standaloneSigmaInr: round(sd(pnl[i] ?? []), 2),
    })),
  };
}

/** portfolio/holding-history: the last 60 daily closes of every holding (own currency). */
export function deriveHoldingHistory(ctx: DeriveContext): HoldingHistoryData {
  const dates = ctx.dataset.dates.slice(-HOLDING_HISTORY_DAYS);
  return {
    asOf: asOfIso(ctx),
    simulated: true,
    dates,
    holdings: liveBook(ctx).map((r) => ({
      holdingId: `HLD-${r.position.id.toUpperCase()}`,
      ticker: r.position.ticker,
      closes: r.position.closes.slice(-dates.length).map((c) => round(c, 4)),
    })),
  };
}

/** Trading days of closes served per Nifty 50 constituent for the symbol panel. */
export const SYMBOL_HISTORY_DAYS = 253;

/** market/symbol-history: one year of simulated closes for every Nifty 50 constituent. */
export function deriveSymbolHistory(ctx: DeriveContext): SymbolHistoryData {
  const { dataset } = ctx;
  return {
    asOf: asOfIso(ctx),
    simulated: true,
    dates: dataset.dates.slice(-SYMBOL_HISTORY_DAYS),
    symbols: dataset.constituents.map((c, i) => ({
      symbol: c.symbol,
      closes: (dataset.stockCloses[i] ?? []).slice(-SYMBOL_HISTORY_DAYS).map((v) => round(v, 2)),
    })),
  };
}
