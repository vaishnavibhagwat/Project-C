import { formatPct } from '@/utils/format';
import { istDateKey } from '@/utils/time';
import type { Alert, AlertsData } from '../schemas';
import { asOfIso, type DeriveContext } from './context';
import { deriveHoldings } from './portfolio';
import { deriveMetrics, deriveVar } from './risk';
import { deriveTrades } from './trades';

/** Risk limits used by the rule engine. Illustrative policy values. */
export const LIMITS = {
  var99Warning: 0.015,
  var99Critical: 0.02,
  singleNameWeightPct: 9,
  priceMovePct: 2.5,
  drawdownWarning: 0.05,
} as const;

/** Rule-based alerts derived from the same data every widget shows. */
export function deriveAlerts(ctx: DeriveContext): AlertsData {
  const at = asOfIso(ctx);
  const alerts: Alert[] = [];

  const risk = deriveVar(ctx);
  const var99 = risk.historical.var99;
  if (var99 >= LIMITS.var99Warning) {
    alerts.push({
      id: 'risk-var99',
      severity: var99 >= LIMITS.var99Critical ? 'critical' : 'warning',
      source: 'Risk',
      title: `1-day 99% historical VaR at ${formatPct(var99, 2, false)} of AUM`,
      detail: `Soft limit ${formatPct(LIMITS.var99Warning, 1, false)}, hard limit ${formatPct(LIMITS.var99Critical, 1, false)}.`,
      triggeredAt: at,
      symbol: null,
    });
  }

  const metrics = deriveMetrics(ctx);
  if (metrics.currentDrawdown >= LIMITS.drawdownWarning) {
    alerts.push({
      id: 'drawdown-current',
      severity: 'warning',
      source: 'Drawdown',
      title: `NAV ${formatPct(metrics.currentDrawdown, 1, false)} below its high-water mark`,
      detail: `Review threshold ${formatPct(LIMITS.drawdownWarning, 0, false)}.`,
      triggeredAt: at,
      symbol: null,
    });
  }

  const { holdings } = deriveHoldings(ctx);
  for (const h of holdings) {
    if (h.weightPct >= LIMITS.singleNameWeightPct) {
      alerts.push({
        id: `conc-${h.symbol}`,
        severity: 'warning',
        source: 'Concentration',
        title: `${h.symbol} is ${h.weightPct.toFixed(1)}% of the equity sleeve`,
        detail: `Single-name guideline ${LIMITS.singleNameWeightPct}%.`,
        triggeredAt: at,
        symbol: h.symbol,
      });
    }
    if (Math.abs(h.dayChangePct) >= LIMITS.priceMovePct) {
      alerts.push({
        id: `move-${h.symbol}`,
        severity: Math.abs(h.dayChangePct) >= LIMITS.priceMovePct * 1.6 ? 'warning' : 'info',
        source: 'Price',
        title: `${h.symbol} ${h.dayChangePct > 0 ? 'up' : 'down'} ${formatPct(h.dayChangePct / 100)} today`,
        detail: `Move exceeds the ${LIMITS.priceMovePct}% intraday watch threshold.`,
        triggeredAt: at,
        symbol: h.symbol,
      });
    }
  }

  const today = istDateKey(ctx.nowMs);
  const settling = deriveTrades(ctx).trades.filter((t) => t.settlementDate === today);
  if (settling.length > 0) {
    alerts.push({
      id: `settle-${today}`,
      severity: 'info',
      source: 'Settlement',
      title: `${settling.length} trades settle today (T+1)`,
      detail: 'Funds and securities obligations due with the clearing corporation today.',
      triggeredAt: at,
      symbol: null,
    });
  }

  const rank = { critical: 0, warning: 1, info: 2 } as const;
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return { asOf: at, simulated: true, alerts };
}
