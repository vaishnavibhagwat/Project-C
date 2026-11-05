import {
  annualisedReturn,
  annualisedVolatility,
  histogram,
  historicalCVaR,
  mean,
  sharpeRatio,
  stdev,
  valueAtRisk,
} from '@/utils/finance';
import { modelStats, STATS_LOOKBACK_DAYS } from '../model';
import type { MetricsData, VarData } from '../schemas';
import { asOfIso, round, type DeriveContext } from './context';

export const VAR_LOOKBACK_DAYS = STATS_LOOKBACK_DAYS;
/** Trading days of rolling VaR history (the gauge's 30-day range band). */
export const VAR_HISTORY_DAYS = 30;

export const VAR_ASSUMPTIONS = [
  'Horizon: 1 trading day. Values are losses as a fraction of AUM at the last close.',
  'Historical simulation: empirical quantile of the last 252 daily fund returns, equally weighted, linear interpolation.',
  'Parametric: variance-covariance on the same 252 returns, assuming normally distributed returns (mean - z * sigma).',
  'Expected shortfall (CVaR): mean of returns at or beyond the historical VaR threshold.',
  '30-day range: the same VaR recomputed on each of the last 30 trading days, each over the 252 returns ending that day.',
  'Returns are daily returns of the NAV derived from the holdings (positions held constant); no liquidity or fat-tail adjustment.',
];

export function deriveVar(ctx: DeriveContext): VarData {
  const { dataset } = ctx;
  const stats = modelStats(dataset);
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
      var95: round(stats.var.historical.var95, 6),
      var99: round(stats.var.historical.var99, 6),
      cvar95: round(historicalCVaR(window, 0.95), 6),
      cvar99: round(historicalCVaR(window, 0.99), 6),
    },
    parametric: {
      var95: round(stats.var.parametric.var95, 6),
      var99: round(stats.var.parametric.var99, 6),
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
    history: varHistory(ctx),
    assumptions: VAR_ASSUMPTIONS,
  };
}

const historyCache = new WeakMap<DeriveContext['dataset'], VarData['history']>();

/** VaR (both methods, 95% and 99%) on each of the last VAR_HISTORY_DAYS trading days. */
function varHistory(ctx: DeriveContext): VarData['history'] {
  const { dataset } = ctx;
  const hit = historyCache.get(dataset);
  if (hit) return hit;
  const r = dataset.fundReturns;
  const out: VarData['history'] = [];
  for (let k = VAR_HISTORY_DAYS - 1; k >= 0; k -= 1) {
    const end = r.length - k;
    if (end < 2) continue;
    const v = valueAtRisk(r.slice(Math.max(0, end - VAR_LOOKBACK_DAYS), end));
    out.push({
      // fundReturns[i] is the return into dates[i + 1], so the window ends on dates[end].
      date: dataset.dates[end] ?? dataset.asOfDate,
      historical: { var95: round(v.historical.var95, 6), var99: round(v.historical.var99, 6) },
      parametric: { var95: round(v.parametric.var95, 6), var99: round(v.parametric.var99, 6) },
    });
  }
  historyCache.set(dataset, out);
  return out;
}

export function deriveMetrics(ctx: DeriveContext): MetricsData {
  const { dataset } = ctx;
  const stats = modelStats(dataset);
  const r = dataset.fundReturns;
  const b = dataset.benchmarkReturns;
  const rf = dataset.riskFreeRate;
  const dd = stats.drawdown;
  const te = stats.trackingError;
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
    observations: r.length,
    cagr: round(stats.cagr, 6),
    annualVolatility: round(stats.volatility, 6),
    sharpe: round(stats.sharpe, 4),
    sortino: round(stats.sortino, 4),
    maxDrawdown: round(dd.depth, 6),
    drawdownPeakDate: dataset.dates[dd.peakIndex] ?? dataset.asOfDate,
    drawdownTroughDate: dataset.dates[dd.troughIndex] ?? dataset.asOfDate,
    drawdownRecoveryDate:
      dd.recoveryIndex === null ? null : (dataset.dates[dd.recoveryIndex] ?? null),
    currentDrawdown: round(1 - last / peak, 6),
    beta: round(stats.beta, 4),
    trackingError: round(te, 6),
    informationRatio: round(te === 0 ? 0 : (annualisedReturn(r) - annualisedReturn(b)) / te, 4),
    calmar: round(dd.depth === 0 ? 0 : stats.cagr / dd.depth, 4),
    oneYear: {
      sharpe: round(sharpeRatio(lastYear, rf), 4),
      volatility: round(annualisedVolatility(lastYear), 6),
      returnPct: round((last / yearBase - 1) * 100, 4),
    },
  };
}
