import { lazy } from 'react';
import { IconBell } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { summarizePanel, unacknowledgedCount, visibleAlerts } from './model';
import {
  AlertPanelConfigSchema,
  type AlertPanelConfig,
  type AlertPanelWidgetData,
  type AlertRule,
} from './types';

/** On demand: no polling. Data counts as stale after 2x this without a push or a Refresh. */
export const ALERT_PANEL_STALE_AFTER_MS = 60_000;

const DEFAULT_RULES: AlertRule[] = [
  { id: 'var99', kind: 'var-above', confidence: '99', limitPct: 1.2, severity: 'warning' },
  { id: 'drawdown10', kind: 'drawdown-above', limitPct: 10, severity: 'critical' },
];

const readOnlyText = (title: string, maxLength: number) => ({
  type: 'string' as const,
  title,
  readOnly: true,
  maxLength,
});

export const alertPanelDefinition: WidgetDefinition<AlertPanelConfig, AlertPanelWidgetData> = {
  id: 'alert-panel',
  name: 'Alert Panel',
  description:
    'Alerts grouped by severity with dismiss and snooze, plus your own rules: price above or below a level, VaR or drawdown beyond a limit.',
  category: WidgetCategory.FEED,
  defaultSize: { w: 3, h: 3 },
  minSize: { w: 3, h: 3 },
  maxSize: { w: 6, h: 10 },
  // Rules, dismissals and snoozes are set from the panel itself (readOnly: not in the form).
  configSchema: {
    type: 'object',
    properties: {
      rules: readOnlyText('Rules', 4000),
      dismissed: readOnlyText('Dismissed alerts', 2000),
      snoozes: readOnlyText('Snoozed alerts', 2000),
      read: readOnlyText('Read alerts', 2000),
      acknowledged: readOnlyText('Acknowledged alerts', 2000),
      minSeverity: {
        title: 'Show alerts from',
        oneOf: [
          { const: 'info', title: 'Info and above' },
          { const: 'warning', title: 'Warning and above' },
          { const: 'critical', title: 'Critical only' },
        ],
      },
      pulseCritical: {
        type: 'boolean',
        title: 'Pulse critical alerts',
        description: 'Never animates when the system asks for reduced motion.',
      },
    },
  },
  defaultConfig: {
    rules: JSON.stringify(DEFAULT_RULES),
    dismissed: '',
    snoozes: '{}',
    read: '',
    acknowledged: '',
    minSeverity: 'info',
    pulseCritical: true,
  },
  component: lazy(() => import('./index')),
  icon: IconBell,
  dataSource: {
    endpoint: 'alerts/panel',
    wsChannel: 'ws://mock/alerts/stream',
    refreshInterval: ALERT_PANEL_STALE_AFTER_MS,
    latencyProfile: 'low',
    onDemand: true,
  },
};

export function summarizeAlertPanel(data: AlertPanelWidgetData, config: AlertPanelConfig): string {
  return summarizePanel(visibleAlerts(data, config, Date.now()));
}

export const alertPanelWidget = defineWidget(alertPanelDefinition, {
  configParser: AlertPanelConfigSchema,
  isData: isEndpointData('alerts/panel'),
  // Nothing to show or check: no alerts and no prices for the rules to watch.
  isEmpty: (d) => d.alerts.length === 0 && d.inputs.quotes.length === 0,
  emptyMessage: 'No alerts and no prices to check rules against.',
  summarize: summarizeAlertPanel,
  // Header badge: unacknowledged alerts still showing (not dismissed or snoozed).
  badge: (data, config) => unacknowledgedCount(data, config, Date.now()),
  skeleton: 'feed',
  preload: () => import('./index'),
});
