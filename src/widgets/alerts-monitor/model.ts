import type { Alert, AlertsMonitorConfig } from './types';

const RANK = { info: 0, warning: 1, critical: 2 } as const;

export function filterAlerts(alerts: readonly Alert[], config: AlertsMonitorConfig): Alert[] {
  return alerts.filter(
    (a) =>
      RANK[a.severity] >= RANK[config.minSeverity] &&
      (config.source === 'ALL' || a.source === config.source),
  );
}
