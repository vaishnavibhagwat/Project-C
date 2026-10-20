import { AnimatePresence, m } from 'framer-motion';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconButton } from './Button';
import { IconClose } from './Icons';

export interface ToastOptions {
  message: string;
  tone?: 'info' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

type Notify = (toast: ToastOptions) => void;

const ToastContext = createContext<Notify | null>(null);

/** Ephemeral confirmations ("Widget removed · Undo"). Not a store: nothing here persists. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const notify = useCallback<Notify>(
    (toast) => {
      counter.current += 1;
      const id = counter.current;
      setItems((list) => [...list.slice(-3), { ...toast, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), toast.durationMs ?? 5000),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <m.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-auto flex items-center gap-2 rounded border border-line-strong bg-raised px-3 py-2 text-sm text-fg shadow-lg"
            >
              <span
                aria-hidden="true"
                className={
                  t.tone === 'error'
                    ? 'text-neg'
                    : t.tone === 'success'
                      ? 'text-pos'
                      : 'text-accent'
                }
              >
                ●
              </span>
              <span className="flex-1">{t.message}</span>
              {t.action ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-accent hover:underline"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              ) : null}
              <IconButton
                label="Dismiss"
                icon={IconClose}
                size="xs"
                onClick={() => dismiss(t.id)}
              />
            </m.div>
          ))}
        </AnimatePresence>
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
