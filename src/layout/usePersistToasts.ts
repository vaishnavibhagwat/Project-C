import { useEffect, useRef } from 'react';
import { useToast } from '@/components/Toast';
import { subscribePersistEvents } from '@/store/persistStatus';

const STORE_LABELS: Record<string, string> = {
  'meridian:layouts': 'Saved layouts',
  'meridian:dashboard': 'Dashboard settings',
  'meridian:widgets': 'Widget settings',
  'meridian:theme': 'Themes',
};

/** Failures of several stores within this window share one toast (storage full hits them all). */
const COALESCE_MS = 5000;

/**
 * Toasts when the browser refuses to save (storage full or disabled) and when saving works
 * again. The app keeps working in memory either way. Mounted once, in AppShell.
 */
export function usePersistToasts(): void {
  const notify = useToast();
  const lastError = useRef(0);
  useEffect(
    () =>
      subscribePersistEvents((event) => {
        const what = STORE_LABELS[event.name] ?? 'Settings';
        if (event.type === 'recovered') {
          notify({
            message: `Browser storage is working again (${what.toLowerCase()} saved).`,
            tone: 'success',
          });
          return;
        }
        const now = Date.now();
        if (now - lastError.current < COALESCE_MS) return;
        lastError.current = now;
        notify({
          tone: 'error',
          message: event.quotaExceeded
            ? 'Browser storage is full. Your changes are kept in memory for this session: export your layouts or delete old ones to free space.'
            : 'Could not save to browser storage. Your changes are kept in memory for this session.',
        });
      }),
    [notify],
  );
}
