import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { istTimeMs } from '@/utils/time';
import { eventBus, type WidgetEventMap } from '@/registry/eventBus';
import { alertPanelDefinition, alertPanelWidget } from '../config';
import AlertPanel from '../index';
import {
  dismissPatch,
  evaluateRules,
  groupBySeverity,
  parseRules,
  snoozePatch,
  snoozeUntil,
  visibleAlerts,
} from '../model';
import type { Alert, AlertPanelConfig, AlertPanelWidgetData } from '../types';
import { calmData, configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = alertPanelDefinition.defaultConfig;
const withConfig = (patch: Partial<AlertPanelConfig>): AlertPanelConfig => ({
  ...defaults,
  ...patch,
});
const NOW = Date.parse(data.asOf);
const reliance = data.inputs.quotes.find((q) => q.ticker === 'RELIANCE');

afterEach(() => {
  vi.useRealTimers();
});

describe('AlertPanel model', () => {
  it('fires price, VaR and drawdown rules only when their condition holds', () => {
    if (!reliance) throw new Error('fixture lacks RELIANCE');
    const inputs = data.inputs;
    const fired = evaluateRules(
      [
        {
          id: 'a',
          kind: 'price-above',
          ticker: 'RELIANCE',
          threshold: reliance.price - 1,
          severity: 'warning',
        },
        {
          id: 'b',
          kind: 'price-below',
          ticker: 'RELIANCE',
          threshold: reliance.price - 1,
          severity: 'warning',
        },
        {
          id: 'c',
          kind: 'var-above',
          confidence: '99',
          limitPct: inputs.var99 * 100 - 0.01,
          severity: 'critical',
        },
        {
          id: 'd',
          kind: 'var-above',
          confidence: '95',
          limitPct: inputs.var95 * 100 + 0.01,
          severity: 'info',
        },
        { id: 'e', kind: 'drawdown-above', limitPct: 0.5, severity: 'critical' },
      ],
      { ...inputs, currentDrawdown: 0.02 },
      data.asOf,
    );
    expect(fired.map((a) => a.alertId)).toEqual(['rule-a', 'rule-c', 'rule-e']);
    expect(fired[0]).toMatchObject({ type: 'price_breach', relatedEntity: 'RELIANCE' });
    expect(fired[1]).toMatchObject({ type: 'risk_limit', severity: 'critical' });
  });

  it('ignores malformed rules instead of failing', () => {
    expect(parseRules('not json')).toEqual([]);
    expect(parseRules('[{"id":"x","kind":"price-above","ticker":"A","threshold":-5}]')).toEqual([]);
    expect(parseRules(defaults.rules)).toHaveLength(2);
  });

  it('snoozes for 15 minutes, 1 hour, or to the next 15:30 IST', () => {
    const morning = istTimeMs('2026-11-05', 10, 0);
    expect(snoozeUntil('15m', morning)).toBe(morning + 15 * 60_000);
    expect(snoozeUntil('1h', morning)).toBe(morning + 3_600_000);
    expect(snoozeUntil('eod', morning)).toBe(istTimeMs('2026-11-05', 15, 30));
    expect(snoozeUntil('eod', istTimeMs('2026-11-05', 16, 0))).toBe(
      istTimeMs('2026-11-06', 15, 30),
    );
  });

  it('hides dismissed and snoozed alerts until the snooze ends, and filters by severity', () => {
    const all = visibleAlerts(data, defaults, NOW);
    const [first, second] = all;
    if (!first || !second) throw new Error('need two alerts');
    const ids = all.map((a) => a.alertId);
    let config = withConfig(dismissPatch(defaults, first.alertId, ids));
    config = withConfig({
      ...config,
      ...snoozePatch(config, second.alertId, NOW + 60_000, ids, NOW),
    });
    const hidden = visibleAlerts(data, config, NOW).map((a) => a.alertId);
    expect(hidden).not.toContain(first.alertId);
    expect(hidden).not.toContain(second.alertId);
    expect(visibleAlerts(data, config, NOW + 61_000).map((a) => a.alertId)).toContain(
      second.alertId,
    );
    const criticalOnly = visibleAlerts(data, withConfig({ minSeverity: 'critical' }), NOW);
    expect(criticalOnly.every((a) => a.severity === 'critical')).toBe(true);
  });

  it('prunes dismissals and snoozes of alerts that are gone', () => {
    const patch = dismissPatch(withConfig({ dismissed: 'old-1,keep' }), 'new', ['keep', 'new']);
    expect(patch.dismissed).toBe('keep,new');
    const s = snoozePatch(
      withConfig({ snoozes: JSON.stringify({ gone: NOW + 1, expired: NOW - 1, keep: NOW + 5 }) }),
      'new',
      NOW + 9,
      ['keep', 'expired', 'new'],
      NOW,
    );
    expect(JSON.parse(s.snoozes)).toEqual({ keep: NOW + 5, new: NOW + 9 });
  });

  it('groups critical, then warning, then info', () => {
    const groups = groupBySeverity(visibleAlerts(data, withConfig({}), NOW));
    const order = ['critical', 'warning', 'info'];
    const seen = groups.map((g) => order.indexOf(g.severity));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('counts alerts needing attention for the header badge', () => {
    const count = visibleAlerts(data, defaults, Date.now()).length;
    expect(alertPanelWidget.badge(data, defaults)).toBe(count);
    expect(count).toBeGreaterThan(0);
  });
});

describe('AlertPanel', () => {
  it('labels each alert with an icon and text as well as colour', () => {
    renderWithProviders(<AlertPanel {...widgetProps(defaults, data)} />);
    const shown = visibleAlerts(data, defaults, Date.now());
    const labels = screen.getAllByText(/^(Critical|Warning|Info)$/, { selector: 'span' });
    expect(labels.length).toBeGreaterThanOrEqual(shown.length);
    for (const g of groupBySeverity(shown)) {
      const section = screen.getByRole('region', { name: new RegExp(`^${g.severity}`, 'i') });
      expect(within(section).getAllByRole('listitem')).toHaveLength(g.alerts.length);
    }
  });

  it('dismisses and snoozes through the config', () => {
    const onConfigChange = vi.fn();
    renderWithProviders(<AlertPanel {...widgetProps(defaults, data, 400, 400, onConfigChange)} />);
    const [dismiss] = screen.getAllByRole('button', { name: /^Dismiss alert:/ });
    if (!dismiss) throw new Error('no alerts');
    fireEvent.click(dismiss);
    expect(onConfigChange).toHaveBeenLastCalledWith({ dismissed: expect.any(String) as string });
    const [snooze] = screen.getAllByRole('button', { name: /^Snooze alert:/ });
    if (!snooze) throw new Error('no alerts');
    fireEvent.click(snooze);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Snooze 1 hour' }));
    const last = onConfigChange.mock.lastCall?.[0] as { snoozes?: string } | undefined;
    expect(Object.values(JSON.parse(last?.snoozes ?? '{}') as Record<string, number>)).toHaveLength(
      1,
    );
  });

  it('publishes ALERT_CLICKED when an alert is clicked', () => {
    const events: WidgetEventMap['ALERT_CLICKED'][] = [];
    const stop = eventBus.subscribe('ALERT_CLICKED', (e) => events.push(e));
    renderWithProviders(<AlertPanel {...widgetProps(defaults, data)} />);
    const first = groupBySeverity(visibleAlerts(data, defaults, Date.now()))[0]?.alerts[0];
    if (!first) throw new Error('no alerts');
    fireEvent.click(screen.getByRole('button', { name: first.message }));
    stop();
    expect(events).toEqual([
      {
        alertId: first.alertId,
        relatedWidget: first.relatedWidget,
        relatedEntity: first.relatedEntity,
      },
    ]);
  });

  it('pulses critical alerts only with motion allowed and the option on', () => {
    const critical: Alert = {
      alertId: 'crit-1',
      type: 'risk_limit',
      severity: 'critical',
      message: 'Critical test alert',
      triggeredAt: data.asOf,
      relatedWidget: 'var-gauge',
      relatedEntity: 'PORTFOLIO',
      acknowledged: false,
    };
    const withCritical: AlertPanelWidgetData = { ...data, alerts: [critical, ...data.alerts] };
    const { container, rerender } = renderWithProviders(
      <AlertPanel {...widgetProps(defaults, withCritical)} />,
    );
    expect(container.querySelector('.motion-safe\\:animate-alert-pulse')).not.toBeNull();
    rerender(<AlertPanel {...widgetProps(withConfig({ pulseCritical: false }), withCritical)} />);
    expect(container.querySelector('.motion-safe\\:animate-alert-pulse')).toBeNull();
  });

  it('shows a toast for a critical alert that arrives after loading', () => {
    const { rerender } = renderWithProviders(<AlertPanel {...widgetProps(defaults, data)} />);
    const critical: Alert = {
      alertId: 'crit-new',
      type: 'risk_limit',
      severity: 'critical',
      message: 'VaR hard limit breached (test)',
      triggeredAt: data.asOf,
      relatedWidget: 'var-gauge',
      relatedEntity: 'PORTFOLIO',
      acknowledged: false,
    };
    rerender(
      <AlertPanel {...widgetProps(defaults, { ...data, alerts: [critical, ...data.alerts] })} />,
    );
    const toast = screen.getByTestId('toasts-assertive');
    expect(toast).toHaveTextContent('Critical alert: VaR hard limit breached (test)');
    expect(within(toast).getByRole('button', { name: 'View' })).toBeInTheDocument();
  });

  it('adds and deletes rules from the Rules view', () => {
    const onConfigChange = vi.fn();
    renderWithProviders(<AlertPanel {...widgetProps(defaults, data, 400, 400, onConfigChange)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
    const rules = screen.getByRole('list', { name: 'Alert rules' });
    expect(within(rules).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    expect(screen.getByText('Enter a number above 0.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1234.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    const added = JSON.parse((onConfigChange.mock.lastCall?.[0] as { rules: string }).rules) as {
      kind: string;
      threshold: number;
    }[];
    expect(added).toHaveLength(3);
    expect(added[2]).toMatchObject({ kind: 'price-above', threshold: 1234.5 });
    fireEvent.click(screen.getAllByRole('button', { name: /^Delete rule:/ })[0] as HTMLElement);
    expect(
      (JSON.parse((onConfigChange.mock.lastCall?.[0] as { rules: string }).rules) as unknown[])
        .length,
    ).toBe(1);
  });

  it('shows configured rules and the severity filter', () => {
    renderWithProviders(<AlertPanel {...widgetProps(configuredConfig, data)} />);
    expect(screen.queryByRole('region', { name: /^Info/ })).not.toBeInTheDocument();
    act(() => undefined);
    if (reliance) {
      expect(screen.getByText(/^Rule: RELIANCE at /)).toBeInTheDocument();
    }
  });
});

describe('AlertPanel read / acknowledge', () => {
  it('shows alerts as new until opened or marked read', () => {
    const onConfigChange = vi.fn();
    renderWithProviders(<AlertPanel {...widgetProps(defaults, data, 400, 400, onConfigChange)} />);
    const shown = visibleAlerts(data, defaults, Date.now());
    expect(screen.getAllByText('New')).toHaveLength(shown.length);
    expect(screen.getByText(`${shown.length} active · ${shown.length} unread`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    const patch = onConfigChange.mock.lastCall?.[0] as { read?: string } | undefined;
    expect(patch?.read?.split(',').sort()).toEqual(shown.map((a) => a.alertId).sort());
  });

  it('acknowledges an alert: still shown, dimmed, and out of the header count', () => {
    const first = groupBySeverity(visibleAlerts(data, defaults, Date.now()))[0]?.alerts[0];
    if (!first) throw new Error('no alerts');
    const acked = withConfig({ acknowledged: first.alertId, read: first.alertId });
    renderWithProviders(<AlertPanel {...widgetProps(acked, data, 400, 400)} />);
    expect(screen.getByText('Acknowledged')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Acknowledge alert: ${first.message}` }),
    ).not.toBeInTheDocument();
    expect(alertPanelWidget.badge(data, acked)).toBe(
      (alertPanelWidget.badge(data, defaults) ?? 0) - 1,
    );
  });

  it('acknowledging marks read too', () => {
    const onConfigChange = vi.fn();
    renderWithProviders(<AlertPanel {...widgetProps(defaults, data, 400, 400, onConfigChange)} />);
    const [ack] = screen.getAllByRole('button', { name: /^Acknowledge alert:/ });
    if (!ack) throw new Error('no alerts');
    fireEvent.click(ack);
    const patch = onConfigChange.mock.lastCall?.[0] as
      { acknowledged?: string; read?: string } | undefined;
    expect(patch?.acknowledged).toBeTruthy();
    expect(patch?.read).toBe(patch?.acknowledged);
  });
});

describe('AlertPanel all-clear', () => {
  it('shows its own all-clear view when prices exist but nothing fires', () => {
    renderWithProviders(<AlertPanel {...widgetProps(defaults, calmData())} />);
    expect(screen.getByText('No active alerts')).toBeInTheDocument();
    expect(alertPanelWidget.isEmpty(calmData())).toBe(false);
    expect(alertPanelWidget.isEmpty(emptyData())).toBe(true);
  });
});

describeWidgetStates('alert-panel', { data: fixtureData, emptyData });
