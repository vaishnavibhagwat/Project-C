import { useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import type { Alert } from '@/types';

/**
 * Alerts with `acknowledged` set from this user's acknowledgements. The API always reports
 * acknowledged: false; the user's choices live in DashboardStore and survive refreshes because
 * alert ids are stable per rule and entity.
 */
export function useAcknowledgedAlerts(alerts: readonly Alert[]): Alert[] {
  const ids = useDashboardStore((s) => s.acknowledgedAlertIds);
  return useMemo(() => {
    const acknowledged = new Set(ids);
    return alerts.map((a) => (acknowledged.has(a.alertId) ? { ...a, acknowledged: true } : a));
  }, [alerts, ids]);
}

export function useAcknowledgeAlerts(): (ids: string[]) => void {
  return useDashboardStore((s) => s.acknowledgeAlerts);
}
