import type { ComponentType, ReactNode } from 'react';
import { Button } from './Button';
import { IconAlert, IconPlug, IconRefresh, IconTable, IconWifiOff, type IconProps } from './Icons';

interface StateViewProps {
  icon: ComponentType<IconProps>;
  tone: 'neutral' | 'error' | 'warning';
  title: string;
  message?: ReactNode;
  action?: ReactNode;
}

const TONES = {
  neutral: 'text-subtle',
  error: 'text-neg',
  warning: 'text-warn',
} as const;

function StateView({ icon: Icon, tone, title, message, action }: StateViewProps) {
  return (
    <div className="flex h-full min-h-[80px] flex-col items-center justify-center gap-1.5 px-4 py-3 text-center">
      <Icon size={20} className={TONES[tone]} />
      <p className="text-sm font-medium text-fg">{title}</p>
      {message ? <p className="max-w-xs text-xs text-muted">{message}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  message: string;
  /** Retry button; omitted when not given. */
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({ message, onRetry, retrying = false }: ErrorStateProps) {
  return (
    <div role="alert" className="h-full">
      <StateView
        icon={IconAlert}
        tone="error"
        title="Couldn’t load this widget"
        message={message}
        action={
          onRetry ? (
            <Button size="sm" icon={IconRefresh} onClick={onRetry} disabled={retrying}>
              {retrying ? 'Retrying…' : 'Retry'}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

export interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ title = 'No data available', message, action }: EmptyStateProps) {
  return (
    <StateView icon={IconTable} tone="neutral" title={title} message={message} action={action} />
  );
}

export interface DisconnectedStateProps {
  /** Reconnect button; omitted when not given. */
  onReconnect?: () => void;
  since?: string;
}

export function DisconnectedState({ onReconnect, since }: DisconnectedStateProps) {
  return (
    <div role="status" className="h-full">
      <StateView
        icon={IconWifiOff}
        tone="warning"
        title="Data feed disconnected"
        message={
          since
            ? `No connection since ${since}. Data will refresh automatically when the feed is back.`
            : 'Data will refresh automatically when the feed is back.'
        }
        action={
          onReconnect ? (
            <Button size="sm" icon={IconPlug} onClick={onReconnect}>
              Reconnect
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
