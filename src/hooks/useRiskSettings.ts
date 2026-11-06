import { createContext, useContext } from 'react';
import type { RiskSettings } from '@/store/schemas';

/**
 * The Risk Analytics page's confidence and horizon controls. Provided by the dashboard page on
 * the Risk page only; widgets elsewhere get null and use their own settings.
 */
export const RiskSettingsContext = createContext<RiskSettings | null>(null);

export function useRiskSettings(): RiskSettings | null {
  return useContext(RiskSettingsContext);
}

/** Square-root-of-time scaling of 1-day VaR to `days` (assumes i.i.d. returns; approximation). */
export function horizonScale(days: number): number {
  return Math.sqrt(Math.max(1, days));
}
