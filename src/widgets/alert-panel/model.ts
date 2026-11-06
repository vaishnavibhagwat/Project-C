import { PORTFOLIO_ENTITY } from '@/data/constants';
import { formatPct } from '@/utils/format';
import { istDateKey, istTimeMs } from '@/utils/time';
import {
  AlertRulesSchema,
  SEVERITIES,
  SnoozesSchema,
  type Alert,
  type AlertPanelConfig,
  type AlertPanelWidgetData,
  type AlertRule,
  type PanelInputs,
  type Severity,
  type SnoozeOption,
} from './types';

function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}

/** Rules from the config; invalid JSON or rules fall back to none (never throws). */
export function parseRules(text: string): AlertRule[] {
  const parsed = AlertRulesSchema.safeParse(parseJson(text));
  return parsed.success ? parsed.data : [];
}

export const serializeRules = (rules: readonly AlertRule[]) => JSON.stringify(rules);

export function parseSnoozes(text: string): Record<string, number> {
  const parsed = SnoozesSchema.safeParse(parseJson(text));
  return parsed.success ? parsed.data : {};
}

export function parseIds(text: string): Set<string> {
  return new Set(text.split(',').filter(Boolean));
}

export const ruleAlertId = (rule: AlertRule) => `rule-${rule.id}`;

/** Price in its own currency, two decimals, Indian digit grouping. */
export function formatQuote(price: number, currency: string): string {
  const body = price.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency === 'INR' ? '₹' : '$'}${body}`;
}

/** The rule's current reading, e.g. "RELIANCE ₹2,812.40" or "99% VaR 1.28%". */
export function ruleReading(rule: AlertRule, inputs: PanelInputs): string {
  if (rule.kind === 'price-above' || rule.kind === 'price-below') {
    const q = inputs.quotes.find((x) => x.ticker === rule.ticker);
    return q ? `${rule.ticker} ${formatQuote(q.price, q.currency)}` : `${rule.ticker}: no price`;
  }
  if (rule.kind === 'var-above') {
    const v = rule.confidence === '99' ? inputs.var99 : inputs.var95;
    return `${rule.confidence}% VaR ${formatPct(v, 2, false)}`;
  }
  return `Drawdown ${formatPct(inputs.currentDrawdown, 1, false)}`;
}

export function describeRule(rule: AlertRule, inputs?: PanelInputs): string {
  if (rule.kind === 'price-above' || rule.kind === 'price-below') {
    const q = inputs?.quotes.find((x) => x.ticker === rule.ticker);
    const level = q ? formatQuote(rule.threshold, q.currency) : String(rule.threshold);
    return `${rule.ticker} price ${rule.kind === 'price-above' ? 'above' : 'below'} ${level}`;
  }
  if (rule.kind === 'var-above') {
    return `1-day ${rule.confidence}% VaR above ${rule.limitPct}% of AUM`;
  }
  return `Drawdown deeper than ${rule.limitPct}%`;
}

/** Alerts for the rules whose condition holds now. */
export function evaluateRules(
  rules: readonly AlertRule[],
  inputs: PanelInputs,
  asOf: string,
): Alert[] {
  return rules.flatMap((rule): Alert[] => {
    const base = {
      alertId: ruleAlertId(rule),
      severity: rule.severity,
      triggeredAt: asOf,
      acknowledged: false,
    };
    if (rule.kind === 'price-above' || rule.kind === 'price-below') {
      const q = inputs.quotes.find((x) => x.ticker === rule.ticker);
      if (!q) return [];
      const above = rule.kind === 'price-above';
      const hit = above ? q.price > rule.threshold : q.price < rule.threshold;
      if (!hit) return [];
      return [
        {
          ...base,
          type: 'price_breach',
          message: `Rule: ${rule.ticker} at ${formatQuote(q.price, q.currency)}, ${above ? 'above' : 'below'} ${formatQuote(rule.threshold, q.currency)}.`,
          relatedWidget: 'holdings-table',
          relatedEntity: rule.ticker,
        },
      ];
    }
    if (rule.kind === 'var-above') {
      const v = rule.confidence === '99' ? inputs.var99 : inputs.var95;
      if (v * 100 <= rule.limitPct) return [];
      return [
        {
          ...base,
          type: 'risk_limit',
          message: `Rule: 1-day ${rule.confidence}% VaR at ${formatPct(v, 2, false)} of AUM, above ${rule.limitPct}%.`,
          relatedWidget: 'var-gauge',
          relatedEntity: PORTFOLIO_ENTITY,
        },
      ];
    }
    if (inputs.currentDrawdown * 100 <= rule.limitPct) return [];
    return [
      {
        ...base,
        type: 'risk_limit',
        message: `Rule: NAV ${formatPct(inputs.currentDrawdown, 1, false)} below its high-water mark, deeper than ${rule.limitPct}%.`,
        relatedWidget: 'drawdown',
        relatedEntity: PORTFOLIO_ENTITY,
      },
    ];
  });
}

const RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };

/** Server alerts plus rule alerts (rules first), before dismiss and snooze. */
export function allAlerts(data: AlertPanelWidgetData, config: AlertPanelConfig): Alert[] {
  return [...evaluateRules(parseRules(config.rules), data.inputs, data.asOf), ...data.alerts];
}

/** Every alert that is not dismissed, not snoozed and at least `minSeverity`. */
export function visibleAlerts(
  data: AlertPanelWidgetData,
  config: AlertPanelConfig,
  nowMs: number,
): Alert[] {
  const dismissed = parseIds(config.dismissed);
  const snoozes = parseSnoozes(config.snoozes);
  return allAlerts(data, config).filter(
    (a) =>
      !dismissed.has(a.alertId) &&
      (snoozes[a.alertId] ?? 0) <= nowMs &&
      RANK[a.severity] >= RANK[config.minSeverity],
  );
}

/** Alerts grouped critical → warning → info (empty groups omitted). */
export function groupBySeverity(
  alerts: readonly Alert[],
): { severity: Severity; alerts: Alert[] }[] {
  return [...SEVERITIES]
    .reverse()
    .map((severity) => ({ severity, alerts: alerts.filter((a) => a.severity === severity) }))
    .filter((g) => g.alerts.length > 0);
}

/** When a snooze ends. "End of day" is the next 15:30 IST (NSE close) after now. */
export function snoozeUntil(option: SnoozeOption, nowMs: number): number {
  if (option === '15m') return nowMs + 15 * 60_000;
  if (option === '1h') return nowMs + 60 * 60_000;
  const close = istTimeMs(istDateKey(nowMs), 15, 30);
  return close > nowMs ? close : istTimeMs(istDateKey(nowMs + 24 * 3_600_000), 15, 30);
}

/** Config patch dismissing `id`; ids no longer present are dropped so the list stays short. */
export function dismissPatch(config: AlertPanelConfig, id: string, present: readonly string[]) {
  const keep = new Set(present);
  const ids = [...parseIds(config.dismissed)].filter((x) => keep.has(x));
  return { dismissed: [...new Set([...ids, id])].join(',') };
}

/** Config patch snoozing `id` until `until`; expired or absent snoozes are dropped. */
export function snoozePatch(
  config: AlertPanelConfig,
  id: string,
  until: number,
  present: readonly string[],
  nowMs: number,
) {
  const keep = new Set(present);
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(parseSnoozes(config.snoozes))) {
    if (keep.has(k) && v > nowMs) next[k] = v;
  }
  next[id] = until;
  return { snoozes: JSON.stringify(next) };
}

export function summarizePanel(alerts: readonly Alert[]): string {
  if (alerts.length === 0) return 'No active alerts.';
  const n = (s: Severity) => alerts.filter((a) => a.severity === s).length;
  const top = alerts.find((a) => a.severity === 'critical') ?? alerts[0];
  const counts = `${alerts.length} active alerts: ${n('critical')} critical, ${n('warning')} warning, ${n('info')} info.`;
  return top ? `${counts} First: ${top.message}` : counts;
}

function mergeIds(current: string, ids: readonly string[], present: readonly string[]): string {
  const keep = new Set(present);
  const kept = [...parseIds(current)].filter((x) => keep.has(x));
  return [...new Set([...kept, ...ids])].join(',');
}

/** Config patch marking `ids` read (ids no longer present are dropped). */
export const readPatch = (
  config: AlertPanelConfig,
  ids: readonly string[],
  present: readonly string[],
) => ({
  read: mergeIds(config.read, ids, present),
});

/** Config patch acknowledging `ids` (ids no longer present are dropped). */
export const acknowledgePatch = (
  config: AlertPanelConfig,
  ids: readonly string[],
  present: readonly string[],
) => ({ acknowledged: mergeIds(config.acknowledged, ids, present) });

export const isRead = (config: AlertPanelConfig, id: string) => parseIds(config.read).has(id);
export const isAcknowledged = (config: AlertPanelConfig, id: string) =>
  parseIds(config.acknowledged).has(id);

/** Alerts showing that nobody has acknowledged yet (the header badge). */
export function unacknowledgedCount(
  data: AlertPanelWidgetData,
  config: AlertPanelConfig,
  nowMs: number,
): number {
  const acked = parseIds(config.acknowledged);
  return visibleAlerts(data, config, nowMs).filter((a) => !acked.has(a.alertId)).length;
}
