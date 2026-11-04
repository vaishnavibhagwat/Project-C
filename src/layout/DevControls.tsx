import { Button } from '@/components/Button';
import { Segmented, Switch } from '@/components/FormControls';
import { IconPause, IconPlay, IconWrench } from '@/components/Icons';
import { Popover } from '@/components/Popover';
import { setSimulatedOutage } from '@/data/connection';
import { setLatencyOverride, setLiveUpdatesPaused, setSimulatedFailure } from '@/data/controls';
import { useConnection } from '@/hooks/useConnection';
import { useDataControls } from '@/hooks/useDataControls';
import type { LatencyProfile } from '@/types';
import { cx } from '@/utils/cx';

/**
 * Global Pause / Resume for live updates. While paused nothing polls and socket pushes are
 * ignored, so widgets keep their last data and turn stale after 2x their refresh interval.
 */
export function LiveUpdatesToggle() {
  const { paused } = useDataControls();
  return (
    <button
      type="button"
      aria-pressed={paused}
      aria-label={paused ? 'Resume live updates' : 'Pause live updates'}
      title={paused ? 'Live updates paused: click to resume' : 'Pause live updates'}
      onClick={() => setLiveUpdatesPaused(!paused)}
      className={cx(
        'flex h-7 items-center gap-1.5 rounded border px-2 text-xs',
        paused ? 'border-warn/50 bg-warn/10 text-warn' : 'border-line text-muted hover:text-fg',
      )}
    >
      {paused ? <IconPlay size={13} /> : <IconPause size={13} />}
      <span className="hidden xl:inline">{paused ? 'Paused' : 'Live'}</span>
    </button>
  );
}

type LatencyChoice = LatencyProfile | 'auto';

const LATENCY_OPTIONS: { value: LatencyChoice; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

/**
 * Developer menu: latency profile for every request, and switches that make the simulated
 * data layer fail or disconnect, so the error, stale and disconnected states can be shown.
 */
export function DeveloperMenu() {
  const controls = useDataControls();
  const connection = useConnection();
  const active = controls.simulateFailure || connection.simulatedOutage || controls.paused;
  return (
    <Popover
      label="Developer tools"
      align="end"
      width="w-80"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`Developer tools${active ? ' (simulation active)' : ''}`}
          className={cx(
            'relative flex h-7 w-7 items-center justify-center rounded border',
            active ? 'border-warn/50 text-warn' : 'border-line text-muted hover:text-fg',
          )}
        >
          <IconWrench size={14} />
          {active ? (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warn"
            />
          ) : null}
        </button>
      )}
    >
      {() => (
        <div className="flex flex-col gap-3 p-3 text-xs">
          <div>
            <p className="font-semibold text-fg">Developer tools</p>
            <p className="text-muted">
              Demonstrate widget states on the simulated data. Nothing here is saved; a reload
              resets it.
            </p>
          </div>
          <Switch
            label="Pause live updates"
            description="Stops polling and socket pushes. Widgets keep their data and turn stale after 2x their refresh interval."
            checked={controls.paused}
            onCheckedChange={setLiveUpdatesPaused}
          />
          <div className="flex flex-col gap-1">
            <span className="font-medium text-fg">Latency profile</span>
            <Segmented<LatencyChoice>
              label="Latency profile"
              value={controls.latencyProfile ?? 'auto'}
              options={LATENCY_OPTIONS}
              onValueChange={(v) => setLatencyOverride(v === 'auto' ? null : v)}
            />
            <span className="text-muted">
              Auto uses each widget&apos;s own profile. Low, normal and high apply to every request
              (base latency × 0.4, 1 or 2.5).
            </span>
          </div>
          <Switch
            label="Simulate failure"
            description="Every request fails with HTTP 503. Widgets show an error with Retry, or keep their last data and turn stale."
            checked={controls.simulateFailure}
            onCheckedChange={setSimulatedFailure}
          />
          <Switch
            label="Simulate disconnect"
            description="The data feed goes offline. Widgets show the disconnected state; the real-time socket falls back and retries."
            checked={connection.simulatedOutage}
            onCheckedChange={setSimulatedOutage}
          />
        </div>
      )}
    </Popover>
  );
}

/** Shown while live updates are paused, with a Resume button. */
export function LiveUpdatesPausedBanner() {
  const { paused } = useDataControls();
  if (!paused) return null;
  return (
    <div
      role="status"
      className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-warn/50 bg-warn/10 px-3 py-2 text-xs text-fg"
    >
      <IconPause size={14} className="text-warn" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Live updates paused.</span>{' '}
        <span className="text-muted">
          Widgets show their last data and turn stale after twice their refresh interval.
        </span>
      </p>
      <Button size="sm" icon={IconPlay} onClick={() => setLiveUpdatesPaused(false)}>
        Resume
      </Button>
    </div>
  );
}
