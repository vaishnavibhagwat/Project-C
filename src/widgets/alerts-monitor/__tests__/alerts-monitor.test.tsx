import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { widgetProps } from '@/__tests__/render';
import { alertsMonitorDefinition, summarizeAlerts } from '../config';
import AlertsMonitor from '../index';
import { filterAlerts } from '../model';
import type { AlertsMonitorConfig } from '../types';
import { configuredConfig, fixtureData } from './index';

describe('AlertsMonitor', () => {
  const data = fixtureData();
  const defaults = alertsMonitorDefinition.defaultConfig;

  it('shows severity as text labels, not colour alone', () => {
    render(<AlertsMonitor {...widgetProps(defaults, data)} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(data.alerts.length);
    expect(screen.getAllByText(/^(Critical|Warning|Info)$/).length).toBe(data.alerts.length);
  });

  it('filters by minimum severity', () => {
    const rows = filterAlerts(data.alerts, configuredConfig);
    expect(rows.every((a) => a.severity !== 'info')).toBe(true);
  });

  it('shows an all-clear message when nothing matches', () => {
    const config: AlertsMonitorConfig = {
      ...defaults,
      source: 'Settlement',
      minSeverity: 'critical',
    };
    render(<AlertsMonitor {...widgetProps(config, data)} />);
    expect(screen.getByText('No alerts at this severity')).toBeInTheDocument();
  });

  it('summarises counts by severity', () => {
    expect(summarizeAlerts(data, defaults)).toMatch(
      /^\d+ active alerts: \d+ critical, \d+ warning\./,
    );
  });
});
