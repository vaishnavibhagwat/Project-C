import { formatPct, formatRatio } from '@/utils/format';
import { formatDateKey } from '@/utils/time';
import type { MetricTile, RiskMetricsConfig, RiskMetricsData } from './types';

export function buildTiles(d: RiskMetricsData, config: RiskMetricsConfig): MetricTile[] {
  const full = config.period === 'full';
  const sharpe = full ? d.sharpe : d.oneYear.sharpe;
  const vol = full ? d.annualVolatility : d.oneYear.volatility;
  const rf = formatPct(d.riskFreeRate, 2, false);
  return [
    {
      key: 'sharpe',
      label: 'Sharpe ratio',
      value: formatRatio(sharpe),
      tone: sharpe >= 1 ? 'good' : sharpe < 0.5 ? 'bad' : 'neutral',
      detail: `rf ${rf}`,
      definition: `(Annualised mean daily return − risk-free ${rf}) ÷ annualised volatility. 252-day year.`,
    },
    {
      key: 'sortino',
      label: 'Sortino ratio',
      value: formatRatio(d.sortino),
      tone: d.sortino >= 1 ? 'good' : 'neutral',
      detail: 'Full period',
      definition: 'Excess return ÷ downside deviation (returns below the daily risk-free rate).',
    },
    {
      key: 'vol',
      label: 'Volatility (ann.)',
      value: formatPct(vol, 1, false),
      tone: 'neutral',
      detail: full ? 'Full period' : 'Trailing 1Y',
      definition: 'Sample standard deviation of daily returns × √252.',
    },
    {
      key: 'cagr',
      label: full ? 'CAGR' : '1Y return',
      value: full ? formatPct(d.cagr, 1) : formatPct(d.oneYear.returnPct / 100, 1),
      tone: (full ? d.cagr : d.oneYear.returnPct) >= 0 ? 'good' : 'bad',
      detail: full ? `Since ${formatDateKey(d.periodStart)}` : 'Trailing 252 sessions',
      definition: 'Compound annual growth rate of NAV per unit.',
    },
    {
      key: 'mdd',
      label: 'Max drawdown',
      value: formatPct(-d.maxDrawdown, 1),
      tone: 'bad',
      detail: `${formatDateKey(d.drawdownPeakDate)} → ${formatDateKey(d.drawdownTroughDate)}`,
      definition: `Largest peak-to-trough fall in NAV. ${d.drawdownRecoveryDate ? `Recovered ${formatDateKey(d.drawdownRecoveryDate)}.` : 'Not yet recovered.'}`,
    },
    {
      key: 'beta',
      label: 'Beta vs Nifty 50',
      value: formatRatio(d.beta),
      tone: 'neutral',
      detail: 'Daily returns',
      definition: 'Covariance of fund and benchmark daily returns ÷ benchmark variance.',
    },
    {
      key: 'te',
      label: 'Tracking error',
      value: formatPct(d.trackingError, 1, false),
      tone: 'neutral',
      definition: 'Annualised standard deviation of daily active returns (fund − benchmark).',
    },
    {
      key: 'ir',
      label: 'Information ratio',
      value: formatRatio(d.informationRatio),
      tone: d.informationRatio >= 0.5 ? 'good' : d.informationRatio < 0 ? 'bad' : 'neutral',
      definition: 'Annualised active return ÷ tracking error.',
    },
    {
      key: 'calmar',
      label: 'Calmar ratio',
      value: formatRatio(d.calmar),
      tone: 'neutral',
      definition: 'CAGR ÷ maximum drawdown.',
    },
    {
      key: 'cdd',
      label: 'Current drawdown',
      value: formatPct(-d.currentDrawdown, 1),
      tone: d.currentDrawdown > 0.05 ? 'bad' : 'neutral',
      definition: 'Distance of the latest NAV below its all-time high.',
    },
  ];
}
