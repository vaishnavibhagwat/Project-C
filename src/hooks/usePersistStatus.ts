import { useCallback, useSyncExternalStore } from 'react';
import {
  getPersistStatus,
  subscribePersistStatus,
  type PersistStatus,
} from '@/store/persistStatus';

/** Write status of one persisted store ("meridian:layouts", …): saved, pending or error. */
export function usePersistStatus(name: string): PersistStatus {
  const get = useCallback(() => getPersistStatus(name), [name]);
  return useSyncExternalStore(subscribePersistStatus, get, get);
}
