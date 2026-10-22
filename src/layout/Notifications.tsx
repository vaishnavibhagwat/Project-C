import { IconButton } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { IconBell } from '@/components/Icons';
import { Popover } from '@/components/Popover';
import { useAcknowledgeAlerts, useAcknowledgedAlerts } from '@/hooks/useAlertAcknowledgements';
import { useEndpoint } from '@/hooks/useEndpoint';
import type { Alert } from '@/types';
import { cx } from '@/utils/cx';
import { ALERT_TYPE_LABEL } from '@/widgets/alerts-monitor/model';
import { formatIstTime } from '@/utils/time';

const NO_ALERTS: Alert[] = [];

const TONE = { critical: 'negative', warning: 'warning', info: 'accent' } as const;

/** Bell menu fed by the alerts endpoint. Unread = warning/critical alerts not yet marked read. */
export function Notifications() {
  const { data } = useEndpoint('alerts/active', 15_000);
  const alerts = useAcknowledgedAlerts(data?.alerts ?? NO_ALERTS);
  const acknowledge = useAcknowledgeAlerts();
  // Badge counts warning and critical alerts that have not been acknowledged.
  const unread = alerts.filter((a) => a.severity !== 'info' && !a.acknowledged).length;

  return (
    <Popover
      label="Notifications"
      width="w-80"
      trigger={(props) => (
        <span className="relative">
          <IconButton
            {...props}
            label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            icon={IconBell}
            size="md"
          />
          {unread ? (
            <span
              aria-hidden="true"
              className="num pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neg px-1 text-[9px] font-bold text-bg"
            >
              {unread}
            </span>
          ) : null}
        </span>
      )}
    >
      {() => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-xs font-semibold text-fg">Alerts</p>
            <button
              type="button"
              className="text-2xs font-medium text-accent hover:underline disabled:opacity-40"
              disabled={unread === 0}
              onClick={() => acknowledge(alerts.map((a) => a.alertId))}
            >
              Acknowledge all
            </button>
          </div>
          <ul className="scroll-thin max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted">No active alerts.</li>
            ) : null}
            {alerts.map((a) => (
              <li
                key={a.alertId}
                className={cx(
                  'flex gap-2 border-b border-line px-3 py-2 last:border-0',
                  a.acknowledged && 'opacity-60',
                )}
              >
                <Badge tone={TONE[a.severity]} className="mt-0.5 shrink-0">
                  {a.severity}
                </Badge>
                <div className="min-w-0">
                  <p className="text-xs text-fg">{a.message}</p>
                  <p className="num text-2xs text-subtle">
                    {ALERT_TYPE_LABEL[a.type]} · {formatIstTime(Date.parse(a.triggeredAt), false)}
                    {a.acknowledged ? ' · acknowledged' : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-3 py-1.5 text-2xs text-subtle">
            Rule-based alerts on simulated data.
          </p>
        </div>
      )}
    </Popover>
  );
}
