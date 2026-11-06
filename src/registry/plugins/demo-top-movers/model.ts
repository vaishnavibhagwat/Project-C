import { formatPctPoints } from '@/utils/format';
import type { Mover, TopMoversConfig, TopMoversData } from './types';

export interface MoverLists {
  gainers: Mover[];
  losers: Mover[];
}

const score = (m: Mover, rankBy: TopMoversConfig['rankBy']) =>
  rankBy === 'percent' ? m.dailyPnLPercent : m.dailyPnL;

/** The day's biggest gainers and losers of the book (positions that did not move are left out). */
export function topMovers(data: TopMoversData, config: TopMoversConfig): MoverLists {
  const n = Number(config.count);
  const ranked = [...data.holdings].sort(
    (a, b) => score(b, config.rankBy) - score(a, config.rankBy),
  );
  return {
    gainers: ranked.filter((m) => score(m, config.rankBy) > 0).slice(0, n),
    losers: ranked
      .filter((m) => score(m, config.rankBy) < 0)
      .reverse()
      .slice(0, n),
  };
}

export function summarizeMovers(data: TopMoversData, config: TopMoversConfig): string {
  const { gainers, losers } = topMovers(data, config);
  const best = gainers[0];
  const worst = losers[0];
  const part = (label: string, m: Mover | undefined) =>
    m ? `${label} ${m.ticker} ${formatPctPoints(m.dailyPnLPercent, 2, true)}` : `no ${label}`;
  return `Top movers today: ${part('best', best)}, ${part('worst', worst)}. ${gainers.length} gainers and ${losers.length} losers shown.`;
}
