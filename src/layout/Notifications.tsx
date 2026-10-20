import { IconButton } from '@/components/Button';
import { Badge } from '@/components/Delta';
import { IconBell } from '@/components/Icons';
import { Popover } from '@/components/Popover';
import { useEndpoint } from '@/hooks/useEndpoint';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatIstTime } from '@/utils/time';

const TONE = { critical: 'negative', warning: 'warning', info: 'accent' } as const;

/** Bell menu fed by the alerts endpoint. Unread = warning/critical alerts not yet marked read. */
export function Notifications() {
  const { data } = useEndpoint('alerts/active', 15_000);
  const readIds = useDashboardStore((s) => s.readAlertIds);
  const markRead = useDashboardStore((s) => s.markNotificationsRead);
  const alerts = data?.alerts ?? [];
  const unread = alerts.filter((a) => a.severity !== 'info' && !readIds.includes(a.id)).length;

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
              onClick={() => markRead(alerts.map((a) => a.id))}
            >
              Mark all read
            </button>
          </div>
          <ul className="scroll-thin max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted">No active alerts.</li>
            ) : null}
            {alerts.map((a) => (
              <li key={a.id} className="flex gap-2 border-b border-line px-3 py-2 last:border-0">
                <Badge tone={TONE[a.severity]} className="mt-0.5 shrink-0">
                  {a.severity}
                </Badge>
                <div className="min-w-0">
                  <p className="text-xs text-fg">{a.title}</p>
                  <p className="num text-2xs text-subtle">
                    {a.source} · {formatIstTime(Date.parse(a.triggeredAt), false)}
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
