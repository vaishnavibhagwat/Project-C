import {
  annualisedReturn,
  annualisedVolatility,
  beta,
  cagr,
  histogram,
  historicalCVaR,
  historicalVaR,
  maxDrawdown,
  mean,
  parametricVaR,
  sharpeRatio,
  sortinoRatio,
  stdev,
  trackingError,
} from '@/utils/finance';
import type { MetricsData, VarData } from '../schemas';
import { asOfIso, round, type DeriveContext } from './context';

export const VAR_LOOKBACK_DAYS = 252;

export const VAR_ASSUMPTIONS = [
  'Horizon: 1 trading day. Values are losses as a fraction of AUM at the last close.',
  'Historical simulation: empirical quantile of the last 252 daily fund returns, equally weighted, linear interpolation.',
  'Parametric: variance-covariance on the same 252 returns, assuming normally distributed returns (mean - z * sigma).',
  'Expected shortfall (CVaR): mean of returns at or beyond the historical VaR threshold.',
  'Returns are simulated fund-level NAV returns; no position-level revaluation, liquidity or fat-tail adjustment.',
];

export function deriveVar(ctx: DeriveContext): VarData {
  const { dataset } = ctx;
  const window = dataset.fundReturns.slice(-VAR_LOOKBACK_DAYS);
  const offset = dataset.fundReturns.length - window.length;
  let worstIndex = 0;
  window.forEach((r, i) => {
    if (r < (window[worstIndex] ?? 0)) worstIndex = i;
  });
  return {
    asOf: asOfIso(ctx),
    simulated: true,
    lookbackDays: window.length,
    horizonDays: 1,
    portfolioValueInr: dataset.aumInr,
    portfolioValueUsd: dataset.aumUsd,
    historical: {
      var95: round(historicalVaR(window, 0.95), 6),
      var99: round(historicalVaR(window, 0.99), 6),
      cvar95: round(historicalCVaR(window, 0.95), 6),
      cvar99: round(historicalCVaR(window, 0.99), 6),
    },
    parametric: {
      var95: round(parametricVaR(window, 0.95), 6),
      var99: round(parametricVaR(window, 0.99), 6),
    },
    meanDailyReturn: round(mean(window), 6),
    stdevDailyReturn: round(stdev(window), 6),
    // fundReturns[i] is the return into dates[i + 1].
    worstDay: {
      date: dataset.dates[offset + worstIndex + 1] ?? dataset.asOfDate,
      returnPct: round((window[worstIndex] ?? 0) * 100, 4),
    },
    histogram: histogram(window, 24).map((b) => ({
      from: round(b.from, 6),
      to: round(b.to, 6),
      count: b.count,
    })),
    assumptions: VAR_ASSUMPTIONS,
  };
}

export function deriveMetrics(ctx: DeriveContext): MetricsData {
  const { dataset } = ctx;
  const r = dataset.fundReturns;
  const b = dataset.benchmarkReturns;
  const rf = dataset.riskFreeRate;
  const dd = maxDrawdown(dataset.fundNav);
  const te = trackingError(r, b);
  const growth = cagr(dataset.fundNav);
  const navs = dataset.fundNav;
  const peak = Math.max(...navs);
  const last = navs[navs.length - 1] ?? peak;
  const lastYear = r.slice(-252);
  const yearBase = navs[Math.max(0, navs.length - 253)] ?? last;

  return {
    asOf: asOfIso(ctx),
    simulated: true,
    riskFreeRate: rf,
    periodStart: dataset.dates[0] ?? dataset.asOfDate,
    cagr: round(growth, 6),
    annualVolatility: round(annualisedVolatility(r), 6),
    sharpe: round(sharpeRatio(r, rf), 4),
    sortino: round(sortinoRatio(r, rf), 4),
    maxDrawdown: round(dd.depth, 6),
    drawdownPeakDate: dataset.dates[dd.peakIndex] ?? dataset.asOfDate,
    drawdownTroughDate: dataset.dates[dd.troughIndex] ?? dataset.asOfDate,
    drawdownRecoveryDate:
      dd.recoveryIndex === null ? null : (dataset.dates[dd.recoveryIndex] ?? null),
    currentDrawdown: round(1 - last / peak, 6),
    beta: round(beta(r, b), 4),
    trackingError: round(te, 6),
    informationRatio: round(te === 0 ? 0 : (annualisedReturn(r) - annualisedReturn(b)) / te, 4),
    calmar: round(dd.depth === 0 ? 0 : growth / dd.depth, 4),
    oneYear: {
      sharpe: round(sharpeRatio(lastYear, rf), 4),
      volatility: round(annualisedVolatility(lastYear), 6),
      returnPct: round((last / yearBase - 1) * 100, 4),
    },
  };
}
