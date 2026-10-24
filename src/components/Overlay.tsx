import { AnimatePresence, m } from 'framer-motion';
import { useCallback, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cx } from '@/utils/cx';
import { IconButton } from './Button';
import { IconClose } from './Icons';

export interface OverlayBaseProps {
  open: boolean;
  /** Called on Escape, overlay click and the close button. */
  onClose: () => void;
  title: string;
  description?: string;
  /** Body. */
  children: ReactNode;
  /** Buttons in the footer, right-aligned. */
  actions?: ReactNode;
  className?: string;
}

export interface ModalProps extends OverlayBaseProps {
  /** sm for confirmations, lg (default) for content. */
  size?: 'sm' | 'md' | 'lg';
  /** Element focused on open (e.g. Cancel in a destructive confirmation). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** 'alertdialog' for confirmations that interrupt the user. */
  role?: 'dialog' | 'alertdialog';
}

const MODAL_WIDTH = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

function Panel({
  onClose,
  title,
  description,
  children,
  actions,
  className,
  kind,
  size = 'lg',
  initialFocusRef,
  role = 'dialog',
}: Omit<ModalProps, 'open'> & { kind: 'drawer' | 'modal' }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const close = useCallback(() => onClose(), [onClose]);
  useFocusTrap(ref, true, close, initialFocusRef);

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
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        {...motionProps}
        className={cx(
          'relative flex max-h-full flex-col border-line-strong bg-panel shadow-2xl outline-none',
          kind === 'drawer'
            ? 'ml-auto h-full w-full max-w-md border-l'
            : cx('m-auto max-h-[85vh] w-[calc(100%-2rem)] rounded-md border', MODAL_WIDTH[size]),
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
        {actions ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
            {actions}
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

/**
 * Centred dialog with a title, body and actions. Closes on Escape, overlay click and the close
 * button; traps focus while open and returns it to the trigger on close.
 */
export function Modal({ open, ...props }: ModalProps) {
  return createPortal(
    <AnimatePresence>
      {open ? <Panel key="modal" kind="modal" {...props} /> : null}
    </AnimatePresence>,
    document.body,
  );
}
