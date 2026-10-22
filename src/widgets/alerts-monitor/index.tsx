import { memo, useMemo } from 'react';
import { Badge } from '@/components/Delta';
import { IconCheck } from '@/components/Icons';
import { useAcknowledgeAlerts, useAcknowledgedAlerts } from '@/hooks/useAlertAcknowledgements';
import { useSymbolDetail } from '@/hooks/useSymbolDetail';
import { PORTFOLIO_ENTITY } from '@/data/derive/alerts';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatIstTime } from '@/utils/time';
import { ALERT_TYPE_LABEL, filterAlerts } from './model';
import type { AlertsMonitorConfig, AlertsMonitorData } from './types';

const SEVERITY = {
  critical: { tone: 'negative', label: 'Critical', mark: '!!' },
  warning: { tone: 'warning', label: 'Warning', mark: '!' },
  info: { tone: 'accent', label: 'Info', mark: 'i' },
} as const;

function AlertsMonitor({
  data,
  config,
}: WidgetComponentProps<AlertsMonitorConfig, AlertsMonitorData>) {
  const alerts = useAcknowledgedAlerts(data.alerts);
  const acknowledge = useAcknowledgeAlerts();
  const rows = useMemo(() => filterAlerts(alerts, config), [alerts, config]);
  const detail = useSymbolDetail();

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <IconCheck size={20} className="text-pos" />
        <p className="text-sm font-medium text-fg">No alerts match</p>
        <p className="text-xs text-muted">Nothing at this severity and type needs attention.</p>
      </div>
    );
  }

  return (
    <ul className="scroll-thin h-full overflow-y-auto">
      {rows.map((a) => {
        const s = SEVERITY[a.severity];
        const isTicker = a.relatedEntity !== PORTFOLIO_ENTITY;
        return (
          <li
            key={a.alertId}
            className={cx(
              'flex gap-2 border-b border-line px-3 py-2',
              a.acknowledged && 'opacity-60',
            )}
          >
            <Badge tone={s.tone} className="mt-0.5 w-16 justify-center">
              <span aria-hidden="true" className="mr-1">
                {s.mark}
              </span>
              {s.label}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium leading-snug text-fg">{a.message}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-2xs text-subtle">
                <span>{ALERT_TYPE_LABEL[a.type]}</span>
                <time className="num" dateTime={a.triggeredAt}>
                  {formatIstTime(Date.parse(a.triggeredAt), false)}
                </time>
                {isTicker && detail ? (
                  <button
                    type="button"
                    className="font-medium text-accent hover:underline"
                    onClick={() => detail.openSymbol(a.relatedEntity)}
                  >
                    View {a.relatedEntity}
                  </button>
                ) : (
                  <span>{isTicker ? a.relatedEntity : 'Portfolio'}</span>
                )}
                {a.acknowledged ? (
                  <span className="font-medium text-muted">
                    <span aria-hidden="true">✓</span> Acknowledged
                  </span>
                ) : (
                  <button
                    type="button"
                    className="font-medium text-accent hover:underline"
                    onClick={() => acknowledge([a.alertId])}
                  >
                    Acknowledge
                  </button>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default memo(AlertsMonitor);
