import { AnimatePresence, m } from 'framer-motion';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/utils/cx';

export interface PopoverProps {
  /** Renders the trigger. Spread the given props onto a button. */
  trigger: (props: {
    'aria-expanded': boolean;
    'aria-controls': string;
    'aria-haspopup': 'dialog';
    onClick: () => void;
  }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  width?: string;
  label: string;
}

/** Anchored panel (notifications, user menu, theme menu). Closes on outside click and Escape. */
export function Popover({ trigger, children, align = 'end', width = 'w-72', label }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={root} className="relative">
      {trigger({
        'aria-expanded': open,
        'aria-controls': id,
        'aria-haspopup': 'dialog',
        onClick: () => setOpen((v) => !v),
      })}
      <AnimatePresence>
        {open ? (
          <m.div
            id={id}
            role="dialog"
            aria-label={label}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cx(
              'absolute top-full z-40 mt-1 rounded-md border border-line-strong bg-panel shadow-xl',
              align === 'end' ? 'right-0' : 'left-0',
              width,
            )}
          >
            {children(close)}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
