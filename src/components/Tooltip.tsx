import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/utils/cx';
import { IconInfo } from './Icons';

export interface InfoTooltipProps {
  /** Short explanation shown on hover or keyboard focus. */
  content: ReactNode;
  label?: string;
  className?: string;
}

const WIDTH = 256;

/**
 * Accessible info tooltip: opens on hover and focus, closes on blur or Escape. Rendered in a
 * portal with fixed positioning so scrolling widget bodies never clip it.
 */
export function InfoTooltip({ content, label = 'More information', className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), window.innerWidth - WIDTH - 8);
    setPos({ left, top: r.bottom + 4 });
  }, [open]);

  return (
    <span
      className={cx('inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        className="inline-flex h-5 w-5 items-center justify-center rounded text-subtle hover:text-fg"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        <IconInfo size={13} />
      </button>
      {open && pos
        ? createPortal(
            <span
              role="tooltip"
              id={id}
              style={{ left: pos.left, top: pos.top, width: WIDTH }}
              className="pointer-events-none fixed z-[70] rounded border border-line-strong bg-raised p-2 text-xs font-normal normal-case leading-snug tracking-normal text-fg shadow-lg"
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
