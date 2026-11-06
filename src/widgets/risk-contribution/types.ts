import { z } from 'zod';
import type { RiskContributionData } from '@/data/schemas';

export const RiskContributionConfigSchema = z.object({
  top: z.enum(['10', '15', '20']),
  /** Used outside the Risk page; on it, the page's controls apply. */
  confidence: z.enum(['95', '99']),
  horizonDays: z.enum(['1', '10']),
  /** Component VaR in money, or each position's share of total risk. */
  measure: z.enum(['var', 'share']),
});

export type RiskContributionConfig = z.infer<typeof RiskContributionConfigSchema>;
export type RiskContributionWidgetData = RiskContributionData;

export interface ContributionRow {
  key: string;
  ticker: string;
  name: string;
  /** Component VaR, INR (negative for diversifiers). */
  varInr: number;
  /** Share of total portfolio risk, percent (sums to 100 over all positions). */
  sharePct: number;
  weightPct: number;
}
