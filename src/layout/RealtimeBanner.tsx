import { Button } from '@/components/Button';
import { IconWifiOff } from '@/components/Icons';
import { wsSimulator, type WsStatus } from '@/data/wsSimulator';
import { useNow } from '@/hooks/useNow';
import { useRealtimeStatus } from '@/hooks/useRealtime';

function RetryCountdown({ status }: { status: WsStatus }) {
  const now = useNow(1000);
  if (status.nextRetryAt === null) return <>Waiting to reconnect.</>;
  const seconds = Math.max(0, Math.ceil((status.nextRetryAt - now) / 1000));
  return (
    <>
      Reconnecting in <span className="num">{seconds}</span> s (attempt {status.failedAttempts + 1}
      ).
    </>
  );
}

/**
 * Shown while the simulated real-time connection is down. Widgets keep updating by polling in
 * the meantime; reconnect attempts back off 1, 2, 4, 8, then 16 s.
 */
export function RealtimeBanner() {
  const status = useRealtimeStatus();
  if (status.state === 'connected') return null;
  return (
    <div
      role="status"
      className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-warn/50 bg-warn/10 px-3 py-2 text-xs text-fg"
    >
      <IconWifiOff size={14} className="text-warn" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Real-time data temporarily unavailable.</span>{' '}
        <span className="text-muted">
          {status.reason === 'network'
            ? 'The data feed is offline. '
            : 'Widgets are polling for updates instead. '}
          <RetryCountdown status={status} />
        </span>
      </p>
      <Button size="sm" onClick={() => wsSimulator.retryNow()}>
        Retry now
      </Button>
    </div>
  );
}
