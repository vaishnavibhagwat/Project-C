import { AnimatePresence, m } from 'framer-motion';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { IconButton } from './Button';
import { IconAlert, IconCheck, IconClose, IconCritical, IconInfo, type IconProps } from './Icons';
import { cx } from '@/utils/cx';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  message: string;
  /** Defaults to info. */
  tone?: ToastTone;
  /** One action, e.g. Undo or View; clicking it also closes the toast. */
  action?: { label: string; onClick: () => void };
  /** Auto-dismiss delay; default 5 s. Hover or focus pauses it. */
  durationMs?: number;
}

/** Default auto-dismiss delay. */
export const TOAST_DURATION_MS = 5000;
/** Toasts kept on screen at once (the oldest leaves first). */
export const MAX_TOASTS = 4;

interface ToastItem extends ToastOptions {
  id: number;
}

type Notify = (toast: ToastOptions) => void;

const ToastContext = createContext<Notify | null>(null);

const TONES: Record<
  ToastTone,
  { icon: ComponentType<IconProps>; label: string; className: string }
> = {
  info: { icon: IconInfo, label: 'Info', className: 'text-info' },
  success: { icon: IconCheck, label: 'Success', className: 'text-pos' },
  warning: { icon: IconAlert, label: 'Warning', className: 'text-warn' },
  error: { icon: IconCritical, label: 'Error', className: 'text-neg' },
};

function Toast({
  toast,
  onDismiss,
  onPause,
  onResume,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
  onPause: (id: number) => void;
  onResume: (id: number) => void;
}) {
  const tone = TONES[toast.tone ?? 'info'];
  const Icon = tone.icon;
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onMouseEnter={() => onPause(toast.id)}
      onMouseLeave={() => onResume(toast.id)}
      onFocus={() => onPause(toast.id)}
      onBlur={() => onResume(toast.id)}
      data-tone={toast.tone ?? 'info'}
      className={cx(
        'pointer-events-auto flex items-center gap-2 rounded border bg-raised px-3 py-2 text-sm text-fg shadow-lg',
        toast.tone === 'error' ? 'border-neg/60' : 'border-line-strong',
      )}
    >
      <Icon size={16} aria-hidden="true" className={cx('shrink-0', tone.className)} />
      <span className="flex-1">
        <span className="sr-only">{tone.label}: </span>
        {toast.message}
      </span>
      {toast.action ? (
        <button
          type="button"
          className="text-xs font-semibold text-accent hover:underline"
          onClick={() => {
            toast.action?.onClick();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
      <IconButton label="Dismiss" icon={IconClose} size="xs" onClick={() => onDismiss(toast.id)} />
    </m.div>
  );
}

/**
 * Notifications in the corner: info, success, warning and error, each with an icon and a text
 * label as well as colour. They close after 5 s (hover or keyboard focus pauses the timer, as
 * WCAG 2.2.1 asks) and can carry one action. Errors are announced assertively, the rest
 * politely. Not a store: nothing here persists.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const durations = useRef(new Map<number, number>());

  const clearTimer = (id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  };

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    clearTimer(id);
    durations.current.delete(id);
  }, []);

  const startTimer = useCallback(
    (id: number) => {
      clearTimer(id);
      const ms = durations.current.get(id) ?? TOAST_DURATION_MS;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ms),
      );
    },
    [dismiss],
  );

  const notify = useCallback<Notify>(
    (toast) => {
      counter.current += 1;
      const id = counter.current;
      durations.current.set(id, toast.durationMs ?? TOAST_DURATION_MS);
      setItems((list) => {
        const kept = list.slice(-(MAX_TOASTS - 1));
        for (const dropped of list.slice(0, list.length - kept.length)) {
          clearTimer(dropped.id);
          durations.current.delete(dropped.id);
        }
        return [...kept, { ...toast, id }];
      });
      startTimer(id);
    },
    [startTimer],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  const value = useMemo(() => notify, [notify]);
  const pause = useCallback((id: number) => clearTimer(id), []);
  const errors = items.filter((t) => t.tone === 'error');
  const others = items.filter((t) => t.tone !== 'error');
  const region = (list: ToastItem[]) => (
    <AnimatePresence initial={false}>
      {list.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={dismiss} onPause={pause} onResume={startTimer} />
      ))}
    </AnimatePresence>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        <div aria-live="assertive" data-testid="toasts-assertive" className="flex flex-col gap-2">
          {region(errors)}
        </div>
        <div aria-live="polite" data-testid="toasts-polite" className="flex flex-col gap-2">
          {region(others)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

/** Returns a notify function; a no-op outside the provider (stories, isolated tests). */
export function useToast(): Notify {
  return useContext(ToastContext) ?? noop;
}

function noop(): void {
  // intentionally empty
}
