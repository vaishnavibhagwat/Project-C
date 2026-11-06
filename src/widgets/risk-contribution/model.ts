import { formatInrCompact } from '@/utils/format';
import type { ContributionRow, RiskContributionConfig, RiskContributionWidgetData } from './types';

/** One-sided normal quantiles. */
export const Z_SCORE = { '95': 1.6449, '99': 2.3263 } as const;

export interface RiskBasis {
  confidence: '95' | '99';
  horizonDays: number;
}

/** Parametric portfolio VaR (INR) for the basis: z × σ(daily P&L) × √horizon (mean ignored). */
export function portfolioVar(data: RiskContributionWidgetData, basis: RiskBasis): number {
  return Z_SCORE[basis.confidence] * data.portfolioSigmaInr * Math.sqrt(basis.horizonDays);
}

/**
 * Component VaR per position (Euler allocation): z × contribution to σ × √horizon. The
 * components add up to the portfolio VaR. The `top` positions by absolute contribution.
 */
export function contributionRows(
  data: RiskContributionWidgetData,
  basis: RiskBasis,
  top: number,
): ContributionRow[] {
  const k = Z_SCORE[basis.confidence] * Math.sqrt(basis.horizonDays);
  const sigma = data.portfolioSigmaInr || 1;
  return data.positions
    .map((p) => ({
      key: p.key,
      ticker: p.ticker,
      name: p.name,
      varInr: p.contributionInr * k,
      sharePct: (p.contributionInr / sigma) * 100,
      weightPct: p.weightPct,
    }))
    .sort((a, b) => Math.abs(b.varInr) - Math.abs(a.varInr))
    .slice(0, top);
}

export function basisFromConfig(config: RiskContributionConfig): RiskBasis {
  return { confidence: config.confidence, horizonDays: Number(config.horizonDays) };
}

export function contributionSummary(
  data: RiskContributionWidgetData,
  basis: RiskBasis,
  top: number,
): string {
  const rows = contributionRows(data, basis, top);
  const total = portfolioVar(data, basis);
  const lead = rows
    .slice(0, 3)
    .map((r) => `${r.ticker} ${r.sharePct.toFixed(1)}%`)
    .join(', ');
  const diversifiers = data.positions.filter((p) => p.contributionInr < 0).length;
  return `${basis.confidence}% ${basis.horizonDays}-day parametric VaR ${formatInrCompact(total)}. Largest shares of risk: ${lead}. ${diversifiers} positions reduce risk.`;
}
