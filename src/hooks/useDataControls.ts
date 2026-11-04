import { useSyncExternalStore } from 'react';
import { getDataControls, subscribeDataControls, type DataControls } from '@/data/controls';

/** Pause, latency override and simulated-failure switches (see src/data/controls.ts). */
export function useDataControls(): DataControls {
  return useSyncExternalStore(subscribeDataControls, getDataControls, getDataControls);
}
