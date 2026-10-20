import { AnimatePresence, m } from 'framer-motion';
import { useCallback, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cx } from '@/utils/cx';
import { IconButton } from './Button';
import { IconClose } from './Icons';

interface OverlayBaseProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

function Panel({
  onClose,
  title,
  description,
  children,
  footer,
  className,
  kind,
}: Omit<OverlayBaseProps, 'open'> & { kind: 'drawer' | 'modal' }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const close = useCallback(() => onClose(), [onClose]);
  useFocusTrap(ref, true, close);

  const motionProps =
    kind === 'drawer'
      ? {
          initial: { x: 24, opacity: 0 },
          animate: { x: 0, opacity: 1 },
          exit: { x: 24, opacity: 0 },
        }
      : {
          initial: { y: 8, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: 8, opacity: 0 },
        };

  return (
    <div className="fixed inset-0 z-50 flex" data-overlay={kind}>
      <m.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
        aria-hidden="true"
      />
      <m.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        {...motionProps}
        className={cx(
          'relative flex max-h-full flex-col border-line-strong bg-panel shadow-2xl outline-none',
          kind === 'drawer'
            ? 'ml-auto h-full w-full max-w-md border-l'
            : 'm-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl rounded-md border',
          className,
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold text-fg">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-0.5 text-xs text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Close" icon={IconClose} onClick={close} />
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </m.div>
    </div>
  );
}

/** Side panel for configuration, layout management and the theme builder. */
export function Drawer({ open, ...props }: OverlayBaseProps) {
  return createPortal(
    <AnimatePresence>
      {open ? <Panel key="drawer" kind="drawer" {...props} /> : null}
    </AnimatePresence>,
    document.body,
  );
}

/** Centred dialog for focused tasks (command palette, symbol detail, share). */
export function Modal({ open, ...props }: OverlayBaseProps) {
  return createPortal(
    <AnimatePresence>
      {open ? <Panel key="modal" kind="modal" {...props} /> : null}
    </AnimatePresence>,
    document.body,
  );
}
