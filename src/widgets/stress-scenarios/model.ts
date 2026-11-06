import { formatPct } from '@/utils/format';
import type { Scenario, StressScenariosData } from './types';

/** The scenario with the largest loss (most negative impact), or null when none lose. */
export function worstScenario(data: StressScenariosData): Scenario | null {
  const losing = data.scenarios.filter((s) => s.impactInr < 0);
  if (losing.length === 0) return null;
  return losing.reduce((a, b) => (b.impactInr < a.impactInr ? b : a));
}

export function stressSummary(data: StressScenariosData): string {
  if (data.scenarios.length === 0) return 'No stress scenarios.';
  const parts = data.scenarios.map((s) => `${s.name} ${formatPct(s.impactPct / 100, 1)}`);
  const worst = worstScenario(data);
  return `Estimated portfolio impact: ${parts.join('; ')}.${worst ? ` Worst: ${worst.name}.` : ''}`;
}
