import type { AlertSeverity, AlertType } from '@/types';
import { istTimeMs, toIstIso } from '@/utils/time';
import { createRng, hashSeed, pick } from '../random';
import { poisson, rollingVolatility } from './gbm';
import { ASSET_CLASSES, type Instrument } from './instruments';
import type { MockWindow } from './window';

/** Window of the rolling volatility that drives alert frequency (trading days). */
export const ALERT_VOL_WINDOW = 20;
/** Alerts a day at median volatility. */
export const BASE_ALERTS_PER_DAY = 0.4;
/**
 * How steeply alert frequency rises with volatility. The fund's daily moves are kept inside
 * 0.1%–2%, which narrows its volatility range, so a steep curve is needed for turbulent days
 * to stand out.
 */
export const ALERT_VOL_EXPONENT = 4;
/** Price-breach threshold for a single holding's daily move. */
export const PRICE_BREACH_PCT = 3;

export interface MockAlert {
  alertId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  triggeredAt: string;
  triggeredMs: number;
  relatedWidget: string;
  relatedEntity: string;
  acknowledged: boolean;
  /** Fund 20-day realised volatility (annualised %) on the day the alert fired. */
  volatilityPct: number;
}

const WIDGET_FOR: Record<AlertType, string> = {
  price_breach: 'holdings-table',
  risk_limit: 'var-gauge',
  news_event: 'research-feed',
  rebalance_signal: 'asset-allocation',
};

/**
 * Alert log over the whole window. The number of alerts each day is Poisson with rate
 * BASE_ALERTS_PER_DAY × (vol / median vol)^4, where vol is the fund's 20-day realised
 * volatility, so alerts cluster in turbulent periods (the drawdown) and are rare in calm ones.
 * Severity also rises with volatility. Alerts older than five trading days are acknowledged.
 */
export function buildAlerts(w: MockWindow, instruments: readonly Instrument[]): MockAlert[] {
  const returns = w.dataset.fundReturns.slice(w.offset);
  const vols = rollingVolatility(returns, ALERT_VOL_WINDOW);
  const sorted = [...vols].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0.12;
  const stocks = instruments.filter((i) => i.instrumentType === 'Stock');
  const alerts: MockAlert[] = [];

  vols.forEach((vol, k) => {
    // returns[k] moves the fund from dates[k] to dates[k + 1].
    const t = k + 1;
    const date = w.dates[t] ?? '';
    const rng = createRng(hashSeed(w.dataset.seed, date, 'mock-alerts'));
    const ratio = vol / median;
    const count = poisson(rng, Math.min(8, BASE_ALERTS_PER_DAY * ratio ** ALERT_VOL_EXPONENT));
    const movers = stocks
      .map((s) => ({ s, r: (s.closes[t] ?? 1) / (s.closes[t - 1] ?? 1) - 1 }))
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const ageDays = w.dates.length - 1 - t;

    for (let n = 0; n < count; n += 1) {
      const type = pick(rng, [
        'price_breach',
        'risk_limit',
        'news_event',
        'rebalance_signal',
      ] as const);
      const level = rng() * ratio;
      const severity: AlertSeverity = level > 1.6 ? 'critical' : level > 0.8 ? 'warning' : 'info';
      let message: string;
      let entity = 'PORTFOLIO';
      if (type === 'price_breach') {
        const m = movers[n % Math.max(1, movers.length)];
        entity = m?.s.ticker ?? 'PORTFOLIO';
        const pct = Math.abs((m?.r ?? 0) * 100).toFixed(1);
        message = `${entity} ${(m?.r ?? 0) >= 0 ? 'up' : 'down'} ${pct}% on the day (watch ±${PRICE_BREACH_PCT}%)`;
      } else if (type === 'risk_limit') {
        message = `Fund 20-day volatility at ${(vol * 100).toFixed(1)}% vs median ${(median * 100).toFixed(1)}%`;
      } else if (type === 'news_event') {
        const m = movers[0];
        entity = m?.s.ticker ?? 'PORTFOLIO';
        message = `Unusual news flow on ${entity} after a ${Math.abs((m?.r ?? 0) * 100).toFixed(1)}% move`;
      } else {
        const sleeve = pick(rng, ASSET_CLASSES);
        message = `${sleeve} weight drifted ${(0.5 + rng() * 2 * ratio).toFixed(1)} pp from target`;
      }
      const minutes = 9 * 60 + 15 + Math.floor(rng() * 375);
      const ms = istTimeMs(date, Math.floor(minutes / 60), minutes % 60);
      alerts.push({
        alertId: `alert-${date}-${n}`,
        type,
        severity,
        message,
        triggeredAt: toIstIso(ms),
        triggeredMs: ms,
        relatedWidget: WIDGET_FOR[type],
        relatedEntity: entity,
        acknowledged: ageDays > 5,
        volatilityPct: Math.round(vol * 10_000) / 100,
      });
    }
  });
  return alerts.sort((a, b) => b.triggeredMs - a.triggeredMs);
}
