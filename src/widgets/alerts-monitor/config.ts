import { lazy } from 'react';
import { IconAlert } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { registerWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { filterAlerts } from './model';
import {
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
  defaultSize: { w: 4, h: 10 },
  minSize: { w: 3, h: 5 },
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
      source: {
        title: 'Source',
        oneOf: ['ALL', 'Risk', 'Concentration', 'Price', 'Settlement', 'Drawdown'].map((v) => ({
          const: v,
          title: v === 'ALL' ? 'All sources' : v,
        })),
      },
      showDetail: { type: 'boolean', title: 'Show rule detail' },
    },
  },
  defaultConfig: { minSeverity: 'info', source: 'ALL', showDetail: true },
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
  return `${rows.length} active alerts: ${critical} critical, ${warning} warning.${rows[0] ? ` Top: ${rows[0].title}.` : ''}`;
}

export const alertsMonitorWidget = registerWidget(alertsMonitorDefinition, {
  configParser: AlertsMonitorConfigSchema,
  isData: isEndpointData('alerts/active'),
  summarize: summarizeAlerts,
  skeleton: 'feed',
  preload: () => import('./index'),
});
