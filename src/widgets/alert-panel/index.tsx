import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Badge, type BadgeTone } from '@/components/Badge';
import { Dropdown } from '@/components/Dropdown';
import {
  IconAlert,
  IconBell,
  IconCheck,
  IconClose,
  IconCritical,
  IconInfo,
  IconSettings,
  IconTrash,
  type IconProps,
} from '@/components/Icons';
import { Select } from '@/components/Select';
import { useToast } from '@/components/Toast';
import { useNow } from '@/hooks/useNow';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatIstTime } from '@/utils/time';
import { eventBus } from '@/registry/eventBus';
import {
  allAlerts,
  describeRule,
  acknowledgePatch,
  dismissPatch,
  parseIds,
  readPatch,
  formatQuote,
  groupBySeverity,
  parseRules,
  ruleAlertId,
  ruleReading,
  serializeRules,
  snoozePatch,
  snoozeUntil,
  summarizePanel,
  visibleAlerts,
} from './model';
import {
  MAX_RULES,
  type Alert,
  type AlertPanelConfig,
  type AlertPanelWidgetData,
  type AlertRule,
  type RuleKind,
  type Severity,
  type SnoozeOption,
} from './types';

const SEVERITY: Record<
  Severity,
  { label: string; tone: BadgeTone; icon: ComponentType<IconProps>; text: string; bar: string }
> = {
  critical: {
    label: 'Critical',
    tone: 'negative',
    icon: IconCritical,
    text: 'text-neg',
    bar: 'border-l-neg',
  },
  warning: {
    label: 'Warning',
    tone: 'warning',
    icon: IconAlert,
    text: 'text-warn',
    bar: 'border-l-warn',
  },
  info: { label: 'Info', tone: 'info', icon: IconInfo, text: 'text-info', bar: 'border-l-info' },
};

const SNOOZES: { id: SnoozeOption; label: string }[] = [
  { id: '15m', label: 'Snooze 15 minutes' },
  { id: '1h', label: 'Snooze 1 hour' },
  { id: 'eod', label: 'Snooze to end of day (15:30 IST)' },
];

/** Critical alerts already announced with a toast (shared by every panel on the page). */
const announced = new Set<string>();

const smallButton =
  'rounded px-1 text-muted hover:bg-raised hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus';

function AlertRow({
  alert,
  domId,
  pulse,
  onOpen,
  onDismiss,
  onSnooze,
  read,
  acknowledged,
  onAcknowledge,
}: {
  alert: Alert;
  domId: string;
  pulse: boolean;
  onOpen: (a: Alert) => void;
  onDismiss: (a: Alert) => void;
  onSnooze: (a: Alert, option: SnoozeOption) => void;
  read: boolean;
  acknowledged: boolean;
  onAcknowledge: (a: Alert) => void;
}) {
  const s = SEVERITY[alert.severity];
  const Icon = s.icon;
  return (
    <li
      id={domId}
      tabIndex={-1}
      data-read={read ? 'true' : 'false'}
      data-acknowledged={acknowledged ? 'true' : 'false'}
      className={cx(
        'border-b border-l-2 border-line px-2 py-1.5 outline-none',
        s.bar,
        acknowledged && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-1.5">
        <span
          aria-hidden="true"
          className={cx(
            'mt-0.5 inline-flex rounded-full',
            s.text,
            pulse && alert.severity === 'critical' && 'motion-safe:animate-alert-pulse',
          )}
        >
          <Icon size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-2xs text-muted">
            <Badge tone={s.tone}>{s.label}</Badge>
            <time className="num" dateTime={alert.triggeredAt}>
              {formatIstTime(Date.parse(alert.triggeredAt), false)}
            </time>
            {read ? null : (
              <span className="font-semibold text-accent">
                <span aria-hidden="true">● </span>New
              </span>
            )}
            {acknowledged ? (
              <span className="text-pos">
                <span aria-hidden="true">✓ </span>Acknowledged
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpen(alert)}
            className={cx(
              'mt-0.5 text-left text-xs text-fg hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus',
              !read && 'font-semibold',
            )}
          >
            {alert.message}
          </button>
        </div>
        {acknowledged ? null : (
          <button
            type="button"
            aria-label={`Acknowledge alert: ${alert.message}`}
            onClick={() => onAcknowledge(alert)}
            className={smallButton}
          >
            <IconCheck size={13} aria-hidden="true" />
          </button>
        )}
        <Dropdown
          align="end"
          width="w-60"
          items={SNOOZES.map((o) => ({
            id: o.id,
            label: o.label,
            onSelect: () => onSnooze(alert, o.id),
          }))}
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={`Snooze alert: ${alert.message}`}
              className={smallButton}
            >
              <IconBell size={13} aria-hidden="true" />
            </button>
          )}
        />
        <button
          type="button"
          aria-label={`Dismiss alert: ${alert.message}`}
          onClick={() => onDismiss(alert)}
          className={smallButton}
        >
          <IconClose size={13} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

const KIND_OPTIONS: { value: RuleKind; label: string }[] = [
  { value: 'price-above', label: 'Price above' },
  { value: 'price-below', label: 'Price below' },
  { value: 'var-above', label: 'VaR exceeds' },
  { value: 'drawdown-above', label: 'Drawdown exceeds' },
];
const SEVERITY_OPTIONS = (['critical', 'warning', 'info'] as const).map((s) => ({
  value: s,
  label: SEVERITY[s].label,
}));

function RulesView({
  rules,
  data,
  onChange,
}: {
  rules: AlertRule[];
  data: AlertPanelWidgetData;
  onChange: (rules: AlertRule[]) => void;
}) {
  const quotes = data.inputs.quotes;
  const [kind, setKind] = useState<RuleKind>('price-above');
  const [ticker, setTicker] = useState(quotes[0]?.ticker ?? '');
  const [confidence, setConfidence] = useState<'95' | '99'>('99');
  const [severity, setSeverity] = useState<Severity>('warning');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const triggered = useMemo(
    () =>
      new Set(
        allAlerts(data, { ...EMPTY_CONFIG, rules: serializeRules(rules) }).map((a) => a.alertId),
      ),
    [data, rules],
  );
  const isPrice = kind === 'price-above' || kind === 'price-below';
  const quote = quotes.find((q) => q.ticker === ticker);

  const add = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a number above 0.');
      return;
    }
    if (rules.length >= MAX_RULES) {
      setError(`At most ${MAX_RULES} rules.`);
      return;
    }
    const id = `r${Date.now().toString(36)}`;
    const rule: AlertRule =
      kind === 'price-above' || kind === 'price-below'
        ? { id, kind, ticker, threshold: n, severity }
        : kind === 'var-above'
          ? { id, kind, confidence, limitPct: Math.min(20, Math.max(0.1, n)), severity }
          : { id, kind, limitPct: Math.min(90, Math.max(0.5, n)), severity };
    setError(null);
    setValue('');
    onChange([...rules, rule]);
  };

  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 py-2 text-xs">
      <ul aria-label="Alert rules" className="flex flex-col gap-1">
        {rules.length === 0 ? <li className="text-muted">No rules yet.</li> : null}
        {rules.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-1.5 rounded border border-line px-1.5 py-1"
          >
            <Badge tone={SEVERITY[r.severity].tone}>{SEVERITY[r.severity].label}</Badge>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-fg">{describeRule(r, data.inputs)}</span>
              <span className="block text-2xs text-muted">
                Now {ruleReading(r, data.inputs)}
                {triggered.has(ruleAlertId(r)) ? ' · triggered' : ' · not triggered'}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Delete rule: ${describeRule(r, data.inputs)}`}
              onClick={() => onChange(rules.filter((x) => x.id !== r.id))}
              className={smallButton}
            >
              <IconTrash size={13} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <form
        aria-label="Add a rule"
        className="flex flex-col gap-1.5 rounded border border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="flex flex-wrap gap-1.5">
          <Select<RuleKind>
            label="Rule"
            value={kind}
            options={KIND_OPTIONS}
            onValueChange={setKind}
          />
          {isPrice ? (
            <Select<string>
              label="Ticker"
              value={ticker}
              options={quotes.map((q) => ({ value: q.ticker, label: q.ticker }))}
              onValueChange={setTicker}
            />
          ) : null}
          {kind === 'var-above' ? (
            <Select<'95' | '99'>
              label="VaR"
              value={confidence}
              options={[
                { value: '95', label: '95%' },
                { value: '99', label: '99%' },
              ]}
              onValueChange={setConfidence}
            />
          ) : null}
          <Select<Severity>
            label="Severity"
            value={severity}
            options={SEVERITY_OPTIONS}
            onValueChange={setSeverity}
          />
        </div>
        <label className="flex items-center gap-1.5 text-2xs text-muted">
          {isPrice ? `Price (${quote?.currency ?? 'INR'})` : 'Limit (%)'}
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? 'rule-error' : undefined}
            className="h-6 w-24 rounded border border-line bg-bg px-1.5 text-xs text-fg focus:border-accent focus:outline-none"
          />
          {isPrice && quote ? <span>now {formatQuote(quote.price, quote.currency)}</span> : null}
        </label>
        {error ? (
          <p id="rule-error" role="alert" className="text-2xs text-neg">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="self-start rounded border border-accent px-2 py-0.5 text-2xs text-accent hover:bg-accent/10"
        >
          Add rule
        </button>
      </form>
    </div>
  );
}

const EMPTY_CONFIG: AlertPanelConfig = {
  rules: '[]',
  dismissed: '',
  snoozes: '{}',
  read: '',
  acknowledged: '',
  minSeverity: 'info',
  pulseCritical: false,
};

function AlertPanel({
  instanceId,
  onConfigChange,
  data,
  config,
}: WidgetComponentProps<AlertPanelConfig, AlertPanelWidgetData>) {
  const now = useNow(30_000);
  const notify = useToast();
  const [view, setView] = useState<'alerts' | 'rules'>('alerts');
  const rules = useMemo(() => parseRules(config.rules), [config.rules]);
  const shown = useMemo(() => visibleAlerts(data, config, now), [data, config, now]);
  const groups = useMemo(() => groupBySeverity(shown), [shown]);
  const presentIds = useMemo(() => allAlerts(data, config).map((a) => a.alertId), [data, config]);
  const domId = useCallback((id: string) => `alert-${instanceId}-${id}`, [instanceId]);

  const readIds = useMemo(() => parseIds(config.read), [config.read]);
  const ackIds = useMemo(() => parseIds(config.acknowledged), [config.acknowledged]);
  const unread = shown.filter((a) => !readIds.has(a.alertId)).length;
  // Opening an alert marks it read and tells other widgets (ALERT_CLICKED).
  const open = useCallback(
    (a: Alert) => {
      if (!readIds.has(a.alertId)) onConfigChange(readPatch(config, [a.alertId], presentIds));
      eventBus.publish('ALERT_CLICKED', {
        alertId: a.alertId,
        relatedWidget: a.relatedWidget,
        relatedEntity: a.relatedEntity,
      });
    },
    [config, onConfigChange, presentIds, readIds],
  );
  const acknowledge = useCallback(
    (a: Alert) =>
      onConfigChange({
        ...acknowledgePatch(config, [a.alertId], presentIds),
        ...readPatch(config, [a.alertId], presentIds),
      }),
    [config, onConfigChange, presentIds],
  );
  const markAllRead = () =>
    onConfigChange(
      readPatch(
        config,
        shown.map((a) => a.alertId),
        presentIds,
      ),
    );
  const dismiss = useCallback(
    (a: Alert) => onConfigChange(dismissPatch(config, a.alertId, presentIds)),
    [config, onConfigChange, presentIds],
  );
  const snooze = useCallback(
    (a: Alert, option: SnoozeOption) => {
      const t = Date.now();
      onConfigChange(snoozePatch(config, a.alertId, snoozeUntil(option, t), presentIds, t));
    },
    [config, onConfigChange, presentIds],
  );

  // A toast for each critical alert that appears after the panel has loaded.
  const primed = useRef(false);
  useEffect(() => {
    const critical = shown.filter((a) => a.severity === 'critical');
    if (!primed.current) {
      primed.current = true;
      for (const a of critical) announced.add(a.alertId);
      return;
    }
    for (const a of critical) {
      if (announced.has(a.alertId)) continue;
      announced.add(a.alertId);
      notify({
        tone: 'error',
        message: `Critical alert: ${a.message}`,
        action: {
          label: 'View',
          onClick: () => {
            setView('alerts');
            open(a);
            requestAnimationFrame(() => document.getElementById(domId(a.alertId))?.focus());
          },
        },
      });
    }
  }, [shown, notify, open, domId]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-2 py-1 text-2xs">
        <span className="text-muted">
          {view === 'alerts'
            ? `${shown.length} active · ${unread} unread`
            : `${rules.length} of ${MAX_RULES} rules`}
        </span>
        {view === 'alerts' && unread > 0 ? (
          <button
            type="button"
            onClick={markAllRead}
            className="ml-auto rounded px-1 text-muted underline hover:text-fg"
          >
            Mark all read
          </button>
        ) : null}
        <button
          type="button"
          aria-pressed={view === 'rules'}
          onClick={() => setView((v) => (v === 'alerts' ? 'rules' : 'alerts'))}
          className="flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-muted hover:bg-raised hover:text-fg"
        >
          {view === 'alerts' ? (
            <>
              <IconSettings size={12} aria-hidden="true" /> Rules
            </>
          ) : (
            <>
              <IconBell size={12} aria-hidden="true" /> Alerts
            </>
          )}
        </button>
      </div>
      <p className="sr-only" role="status">
        {summarizePanel(shown)}
      </p>
      {view === 'rules' ? (
        <RulesView
          rules={rules}
          data={data}
          onChange={(next) => onConfigChange({ rules: serializeRules(next) })}
        />
      ) : groups.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <IconCheck size={20} className="text-pos" aria-hidden="true" />
          <p className="text-sm font-medium text-fg">No active alerts</p>
          <p className="text-xs text-muted">Dismissed and snoozed alerts are hidden.</p>
        </div>
      ) : (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {groups.map((g) => (
            <section key={g.severity} aria-label={`${SEVERITY[g.severity].label} alerts`}>
              <h3 className="sticky top-0 z-[1] flex items-center gap-1 bg-panel px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-muted">
                {SEVERITY[g.severity].label}
                <span className="num">({g.alerts.length})</span>
              </h3>
              <ul>
                {g.alerts.map((a) => (
                  <AlertRow
                    key={a.alertId}
                    alert={a}
                    domId={domId(a.alertId)}
                    pulse={config.pulseCritical}
                    onOpen={open}
                    onDismiss={dismiss}
                    onSnooze={snooze}
                    read={readIds.has(a.alertId)}
                    acknowledged={ackIds.has(a.alertId)}
                    onAcknowledge={acknowledge}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(AlertPanel);
