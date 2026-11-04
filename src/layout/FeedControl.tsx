import { IconPlug, IconWifiOff } from '@/components/Icons';
import { Popover } from '@/components/Popover';
import { Switch } from '@/components/FormControls';
import { setSimulatedOutage } from '@/data/connection';
import { wsSimulator } from '@/data/wsSimulator';
import { useConnection } from '@/hooks/useConnection';
import { useLastUpdated } from '@/hooks/useLastUpdated';
import { useNow } from '@/hooks/useNow';
import { useRealtimeStatus } from '@/hooks/useRealtime';
import { cx } from '@/utils/cx';
import { formatAge, formatIstTime } from '@/utils/time';

/** Feed status + last-updated time. The menu can simulate an outage to show disconnected states. */
export function FeedControl() {
  const connection = useConnection();
  const last = useLastUpdated();
  const now = useNow(5000);
  const connected = connection.connected;
  const realtime = useRealtimeStatus();
  return (
    <Popover
      label="Data feed"
      align="end"
      width="w-72"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={
            connected
              ? `Feed live${last > 0 ? `, last update ${formatIstTime(last)}` : ''}`
              : 'Feed disconnected'
          }
          className={cx(
            'flex h-7 items-center gap-1.5 rounded border px-2 text-xs',
            connected
              ? 'border-line text-muted hover:text-fg'
              : 'border-warn/50 bg-warn/10 text-warn',
          )}
        >
          {connected ? <IconPlug size={13} /> : <IconWifiOff size={13} />}
          <span className="hidden sm:inline">{connected ? 'Feed live' : 'Disconnected'}</span>
          {last > 0 ? (
            <span
              className="num hidden text-subtle md:inline"
              title={`Last update ${formatIstTime(last)}`}
            >
              · {formatIstTime(last)}
            </span>
          ) : null}
        </button>
      )}
    >
      {() => (
        <div className="flex flex-col gap-3 p-3 text-xs">
          <div>
            <p className="font-semibold text-fg">Simulated market data feed</p>
            <p className="text-muted">
              {connected ? 'Connected.' : 'Disconnected.'} Last update{' '}
              {last > 0 ? `${formatIstTime(last)} (${formatAge(now - last)})` : 'pending'}.
            </p>
            {!connection.browserOnline ? (
              <p className="mt-1 text-warn">Your browser reports it is offline.</p>
            ) : null}
          </div>
          <p className="text-muted">
            Real-time (simulated WebSocket):{' '}
            <span className={realtime.state === 'connected' ? 'text-pos' : 'text-warn'}>
              {realtime.state === 'connected' ? 'connected' : 'reconnecting'}
            </span>
            {realtime.state === 'connected' ? '' : '; widgets are polling instead'}.
          </p>
          <Switch
            label="Drop real-time connection"
            description="Simulates the socket server going away. Widgets fall back to polling; reconnects back off 1, 2, 4, 8, 16 s and succeed once this is off."
            checked={wsSimulator.isServerDown()}
            onCheckedChange={(down) => {
              if (down) wsSimulator.simulateDisconnect(Number.POSITIVE_INFINITY);
              else wsSimulator.restore();
            }}
          />
          <Switch
            label="Simulate feed outage"
            description="Stops all data requests so widgets show disconnected and stale states."
            checked={connection.simulatedOutage}
            onCheckedChange={setSimulatedOutage}
          />
        </div>
      )}
    </Popover>
  );
}
