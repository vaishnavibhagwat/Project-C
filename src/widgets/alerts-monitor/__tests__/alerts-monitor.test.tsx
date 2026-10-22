import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { useDashboardStore } from '@/store/dashboardStore';
import { alertsMonitorDefinition, summarizeAlerts } from '../config';
import AlertsMonitor from '../index';
import { filterAlerts } from '../model';
import type { AlertsMonitorConfig } from '../types';
import { configuredConfig, fixtureData } from './index';

const initial = useDashboardStore.getState();

describe('AlertsMonitor', () => {
  const data = fixtureData();
  const defaults = alertsMonitorDefinition.defaultConfig;

  beforeEach(() => useDashboardStore.setState(initial, true));

  it('returns spec Alert objects, unacknowledged from the API', () => {
    const types = new Set(['price_breach', 'risk_limit', 'news_event', 'rebalance_signal']);
    expect(data.alerts.length).toBeGreaterThan(0);
    for (const a of data.alerts) {
      expect(types.has(a.type)).toBe(true);
      expect(a.acknowledged).toBe(false);
      expect(a.relatedWidget).toMatch(/^[a-z-]+$/);
      expect(a.relatedEntity.length).toBeGreaterThan(0);
    }
  });

  it('shows severity as text labels, not colour alone', () => {
    render(<AlertsMonitor {...widgetProps(defaults, data)} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(data.alerts.length);
    expect(screen.getAllByText(/^(Critical|Warning|Info)$/).length).toBe(data.alerts.length);
  });

  it('acknowledges an alert and can hide acknowledged ones', () => {
    const first = data.alerts[0];
    if (!first) throw new Error('fixture has no alerts');
    const { rerender } = render(<AlertsMonitor {...widgetProps(defaults, data)} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Acknowledge' })[0] as HTMLElement);
    expect(useDashboardStore.getState().acknowledgedAlertIds).toContain(first.alertId);
    expect(screen.getByText('Acknowledged')).toBeInTheDocument();
    const hidden: AlertsMonitorConfig = { ...defaults, showAcknowledged: false };
    rerender(<AlertsMonitor {...widgetProps(hidden, data)} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(data.alerts.length - 1);
  });

  it('filters by minimum severity and type', () => {
    expect(filterAlerts(data.alerts, configuredConfig).every((a) => a.severity !== 'info')).toBe(
      true,
    );
    const risk = filterAlerts(data.alerts, { ...defaults, type: 'risk_limit' });
    expect(risk.every((a) => a.type === 'risk_limit')).toBe(true);
  });

  it('shows an all-clear message when nothing matches', () => {
    const config: AlertsMonitorConfig = {
      ...defaults,
      type: 'news_event',
      minSeverity: 'critical',
    };
    render(<AlertsMonitor {...widgetProps(config, data)} />);
    expect(screen.getByText('No alerts match')).toBeInTheDocument();
  });

  it('summarises counts by severity', () => {
    expect(summarizeAlerts(data, defaults)).toMatch(
      /^\d+ active alerts: \d+ critical, \d+ warning\./,
    );
  });
});
