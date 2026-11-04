import type { LatencyProfile } from '@/types';

/**
 * Demo controls for the simulated data layer (like the connection switch in connection.ts,
 * module state rather than a Zustand store: nothing here is persisted, a reload resets it).
 *
 * - `paused`: live updates stop. Widgets keep their last data and stop polling, socket pushes
 *   are ignored, so after 2x their refresh interval they show the stale state. Resume
 *   refreshes everything.
 * - `latencyProfile`: overrides every request's latency profile (null = each widget's own).
 * - `simulateFailure`: every request fails with a simulated HTTP 503, so widgets show their
 *   error state with Retry (or keep their last data and turn stale).
 *
 * The disconnect switch is `setSimulatedOutage` in connection.ts.
 */
export interface DataControls {
  paused: boolean;
  latencyProfile: LatencyProfile | null;
  simulateFailure: boolean;
}

const INITIAL: DataControls = { paused: false, latencyProfile: null, simulateFailure: false };

let current: DataControls = INITIAL;
const listeners = new Set<() => void>();

function update(patch: Partial<DataControls>): void {
  const next = { ...current, ...patch };
  if (
    next.paused === current.paused &&
    next.latencyProfile === current.latencyProfile &&
    next.simulateFailure === current.simulateFailure
  ) {
    return;
  }
  current = next;
  for (const listener of [...listeners]) listener();
}

export function getDataControls(): DataControls {
  return current;
}

export function subscribeDataControls(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLiveUpdatesPaused(paused: boolean): void {
  update({ paused });
}

export function isLiveUpdatesPaused(): boolean {
  return current.paused;
}

export function setLatencyOverride(latencyProfile: LatencyProfile | null): void {
  update({ latencyProfile });
}

/** The latency profile a request should use: the global override, else its own. */
export function effectiveLatencyProfile(own: LatencyProfile = 'normal'): LatencyProfile {
  return current.latencyProfile ?? own;
}

export function setSimulatedFailure(simulateFailure: boolean): void {
  update({ simulateFailure });
}

export function isFailureSimulated(): boolean {
  return current.simulateFailure;
}

/** Back to defaults (tests). */
export function resetDataControls(): void {
  update(INITIAL);
}
