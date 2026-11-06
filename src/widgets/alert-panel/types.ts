import { z } from 'zod';
import type { AlertPanelData } from '@/data/schemas';
import type { Alert } from '@/types';

export const SEVERITIES = ['info', 'warning', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

const ruleBase = {
  id: z.string().regex(/^[a-z0-9-]{1,24}$/),
  severity: z.enum(SEVERITIES),
};

/** One user rule. Prices are in the holding's own currency; limits are percentages. */
export const AlertRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    ...ruleBase,
    kind: z.literal('price-above'),
    ticker: z.string().min(1).max(40),
    threshold: z.number().positive().finite(),
  }),
  z.object({
    ...ruleBase,
    kind: z.literal('price-below'),
    ticker: z.string().min(1).max(40),
    threshold: z.number().positive().finite(),
  }),
  z.object({
    ...ruleBase,
    kind: z.literal('var-above'),
    confidence: z.enum(['95', '99']),
    limitPct: z.number().min(0.1).max(20),
  }),
  z.object({
    ...ruleBase,
    kind: z.literal('drawdown-above'),
    limitPct: z.number().min(0.5).max(90),
  }),
]);
export type AlertRule = z.infer<typeof AlertRuleSchema>;
export type RuleKind = AlertRule['kind'];
export const MAX_RULES = 20;
export const AlertRulesSchema = z.array(AlertRuleSchema).max(MAX_RULES);

/** alertId → epoch ms until which it is hidden. */
export const SnoozesSchema = z.record(z.string().min(1), z.number().int().positive());

export const AlertPanelConfigSchema = z.object({
  /** JSON array of AlertRule (set from the Rules view). */
  rules: z.string().max(4000),
  /** Dismissed alert ids, comma-separated (set by Dismiss). */
  dismissed: z.string().max(2000),
  /** JSON object alertId → snoozed-until epoch ms (set by Snooze). */
  snoozes: z.string().max(2000),
  /** Read alert ids, comma-separated (opening an alert or Mark all read). */
  read: z.string().max(2000),
  /** Acknowledged alert ids, comma-separated (still shown, dimmed). */
  acknowledged: z.string().max(2000),
  minSeverity: z.enum(SEVERITIES),
  /** Pulse critical alerts (never under prefers-reduced-motion). */
  pulseCritical: z.boolean(),
});

export type AlertPanelConfig = z.infer<typeof AlertPanelConfigSchema>;
export type AlertPanelWidgetData = AlertPanelData;
export type PanelInputs = AlertPanelData['inputs'];
export type SnoozeOption = '15m' | '1h' | 'eod';
export type { Alert };
