import type { Alert, AlertSeverity } from '@/types';
import { formatPct } from '@/utils/format';
import type { AlertsData } from '../schemas';
import { asOfIso, type DeriveContext } from './context';
import { deriveHoldings } from './portfolio';
import { deriveResearch } from './research';
import { deriveMetrics, deriveVar } from './risk';

/** Risk limits used by the rule engine. Illustrative policy values. */
export const LIMITS = {
  var99Warning: 0.015,
  var99Critical: 0.02,
  singleNameWeightPct: 9,
  priceMovePct: 2.5,
  drawdownWarning: 0.05,
  /** |sentimentScore| at or above which research on a held ticker raises a news alert. */
  newsSentiment: 0.8,
  /** Most recent qualifying news alerts kept. */
  newsAlerts: 3,
} as const;

/** relatedEntity for fund-level alerts. */
export const PORTFOLIO_ENTITY = 'PORTFOLIO';

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Rule-based alerts derived from the same data every widget shows. The API always reports
 * acknowledged: false; acknowledgements are a per-user overlay kept in DashboardStore.
 */
export function deriveAlerts(ctx: DeriveContext): AlertsData {
  const at = asOfIso(ctx);
  const alerts: Alert[] = [];
  const add = (alert: Omit<Alert, 'triggeredAt' | 'acknowledged'>) =>
    alerts.push({ ...alert, triggeredAt: at, acknowledged: false });

  // risk_limit: 1-day 99% historical VaR against soft and hard limits.
  const var99 = deriveVar(ctx).historical.var99;
  if (var99 >= LIMITS.var99Warning) {
    add({
      alertId: 'risk-var99',
      type: 'risk_limit',
      severity: var99 >= LIMITS.var99Critical ? 'critical' : 'warning',
      message:
        `1-day 99% historical VaR at ${formatPct(var99, 2, false)} of AUM ` +
        `(soft limit ${formatPct(LIMITS.var99Warning, 1, false)}, hard limit ${formatPct(LIMITS.var99Critical, 1, false)}).`,
      relatedWidget: 'var-gauge',
      relatedEntity: PORTFOLIO_ENTITY,
    });
  }

  // risk_limit: NAV below its high-water mark.
  const metrics = deriveMetrics(ctx);
  if (metrics.currentDrawdown >= LIMITS.drawdownWarning) {
    add({
      alertId: 'drawdown-current',
      type: 'risk_limit',
      severity: 'warning',
      message: `NAV ${formatPct(metrics.currentDrawdown, 1, false)} below its high-water mark (review threshold ${formatPct(LIMITS.drawdownWarning, 0, false)}).`,
      relatedWidget: 'drawdown',
      relatedEntity: PORTFOLIO_ENTITY,
    });
  }

  const { holdings } = deriveHoldings(ctx);
  for (const h of holdings) {
    // rebalance_signal: single-name concentration above guideline.
    if (h.weight >= LIMITS.singleNameWeightPct) {
      add({
        alertId: `conc-${h.ticker}`,
        type: 'rebalance_signal',
        severity: 'warning',
        message: `${h.ticker} is ${h.weight.toFixed(1)}% of the equity sleeve (single-name guideline ${LIMITS.singleNameWeightPct}%). Consider trimming.`,
        relatedWidget: 'holdings-table',
        relatedEntity: h.ticker,
      });
    }
    // price_breach: large intraday move.
    if (Math.abs(h.dailyPnLPercent) >= LIMITS.priceMovePct) {
      add({
        alertId: `move-${h.ticker}`,
        type: 'price_breach',
        severity: Math.abs(h.dailyPnLPercent) >= LIMITS.priceMovePct * 1.6 ? 'warning' : 'info',
        message: `${h.ticker} ${h.dailyPnLPercent > 0 ? 'up' : 'down'} ${formatPct(h.dailyPnLPercent / 100)} today (watch threshold ${LIMITS.priceMovePct}%).`,
        relatedWidget: 'holdings-treemap',
        relatedEntity: h.ticker,
      });
    }
  }

  // news_event: strongly positive or negative research on a ticker the fund holds.
  const held = new Set(holdings.map((h) => h.ticker));
  const news = deriveResearch(ctx)
    .articles.filter(
      (a) =>
        Math.abs(a.sentimentScore) >= LIMITS.newsSentiment &&
        a.relevantTickers.some((t) => held.has(t)),
    )
    .slice(0, LIMITS.newsAlerts);
  for (const a of news) {
    const ticker = a.relevantTickers.find((t) => held.has(t)) ?? a.relevantTickers[0] ?? '';
    alerts.push({
      alertId: `news-${a.articleId}`,
      type: 'news_event',
      severity: a.sentimentScore < 0 ? 'warning' : 'info',
      message: `${a.sentiment === 'negative' ? 'Negative' : 'Positive'} research on held ${ticker} (sentiment ${a.sentimentScore.toFixed(2)}): ${a.headline}`,
      triggeredAt: a.publishedAt,
      relatedWidget: 'research-feed',
      relatedEntity: ticker,
      acknowledged: false,
    });
  }

  alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return { asOf: at, simulated: true, alerts };
}
