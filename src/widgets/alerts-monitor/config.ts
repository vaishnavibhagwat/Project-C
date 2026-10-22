import { lazy } from 'react';
import { IconAlert } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { ALERT_TYPE_LABEL, filterAlerts } from './model';
import {
  ALERT_TYPE_FILTERS,
  AlertsMonitorConfigSchema,
  type AlertsMonitorConfig,
  type AlertsMonitorData,
} from './types';

export const alertsMonitorDefinition: WidgetDefinition<AlertsMonitorConfig, AlertsMonitorData> = {
  id: 'alerts-monitor',
  name: 'Alerts',
  description:
    'Rule-based alerts derived from the same data as every other widget: VaR limits, concentration, large price moves, drawdown and T+1 settlement.',
  category: WidgetCategory.FEED,
  defaultSize: { w: 4, h: 5 },
  minSize: { w: 3, h: 3 },
  configSchema: {
    type: 'object',
    properties: {
      minSeverity: {
        title: 'Minimum severity',
        oneOf: [
          { const: 'info', title: 'Info and above' },
          { const: 'warning', title: 'Warning and above' },
          { const: 'critical', title: 'Critical only' },
        ],
      },
      type: {
        title: 'Alert type',
        oneOf: ALERT_TYPE_FILTERS.map((v) => ({
          const: v,
          title: v === 'all' ? 'All types' : ALERT_TYPE_LABEL[v],
        })),
      },
      showAcknowledged: { type: 'boolean', title: 'Show acknowledged alerts' },
    },
  },
  defaultConfig: { minSeverity: 'info', type: 'all', showAcknowledged: true },
  component: lazy(() => import('./index')),
  icon: IconAlert,
  dataSource: {
    endpoint: 'alerts/active',
    wsChannel: 'alerts',
    refreshInterval: 15_000,
    latencyProfile: 'normal',
  },
};

export function summarizeAlerts(data: AlertsMonitorData, config: AlertsMonitorConfig): string {
  const rows = filterAlerts(data.alerts, config);
  const critical = rows.filter((a) => a.severity === 'critical').length;
  const warning = rows.filter((a) => a.severity === 'warning').length;
  return `${rows.length} active alerts: ${critical} critical, ${warning} warning.${rows[0] ? ` Top: ${rows[0].message}` : ''}`;
}

export const alertsMonitorWidget = defineWidget(alertsMonitorDefinition, {
  configParser: AlertsMonitorConfigSchema,
  isData: isEndpointData('alerts/active'),
  summarize: summarizeAlerts,
  skeleton: 'feed',
  preload: () => import('./index'),
});
