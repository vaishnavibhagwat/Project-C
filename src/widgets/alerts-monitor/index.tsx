import { memo, useMemo } from 'react';
import { Badge } from '@/components/Delta';
import { IconCheck } from '@/components/Icons';
import { useSymbolDetail } from '@/hooks/useSymbolDetail';
import type { WidgetComponentProps } from '@/types';
import { formatIstTime } from '@/utils/time';
import { filterAlerts } from './model';
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
  const rows = useMemo(() => filterAlerts(data.alerts, config), [data.alerts, config]);
  const detail = useSymbolDetail();

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <IconCheck size={20} className="text-pos" />
        <p className="text-sm font-medium text-fg">No alerts at this severity</p>
        <p className="text-xs text-muted">All monitored limits are within thresholds.</p>
      </div>
    );
  }

  return (
    <ul className="scroll-thin h-full overflow-y-auto">
      {rows.map((a) => {
        const s = SEVERITY[a.severity];
        return (
          <li key={a.id} className="flex gap-2 border-b border-line px-3 py-2">
            <Badge tone={s.tone} className="mt-0.5 w-16 justify-center">
              <span aria-hidden="true" className="mr-1">
                {s.mark}
              </span>
              {s.label}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium leading-snug text-fg">{a.title}</p>
              {config.showDetail ? (
                <p className="text-2xs leading-snug text-muted">{a.detail}</p>
              ) : null}
              <p className="mt-0.5 flex items-center gap-2 text-2xs text-subtle">
                <span>{a.source}</span>
                <time className="num" dateTime={a.triggeredAt}>
                  {formatIstTime(Date.parse(a.triggeredAt), false)}
                </time>
                {a.symbol && detail ? (
                  <button
                    type="button"
                    className="font-medium text-accent hover:underline"
                    onClick={() => detail.openSymbol(a.symbol ?? '')}
                  >
                    View {a.symbol}
                  </button>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default memo(AlertsMonitor);
