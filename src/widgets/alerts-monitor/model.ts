import type { Alert, AlertsMonitorConfig, AlertType } from './types';

const RANK = { info: 0, warning: 1, critical: 2 } as const;

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  price_breach: 'Price breach',
  risk_limit: 'Risk limit',
  news_event: 'News event',
  rebalance_signal: 'Rebalance signal',
};

export function filterAlerts(alerts: readonly Alert[], config: AlertsMonitorConfig): Alert[] {
  return alerts.filter(
    (a) =>
      RANK[a.severity] >= RANK[config.minSeverity] &&
      (config.type === 'all' || a.type === config.type) &&
      (config.showAcknowledged || !a.acknowledged),
  );
}
