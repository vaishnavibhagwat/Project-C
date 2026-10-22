import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/utils/cx';
import { IconInfo } from './Icons';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

/** Props to spread onto the element the tooltip describes. */
export interface TooltipTriggerProps {
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: () => void;
  'aria-describedby'?: string;
}

export interface TooltipProps {
  content: ReactNode;
  side?: TooltipSide;
  /**
   * Visual only, hidden from assistive technology. Use when the trigger already has the same
   * text as its accessible name (an icon button's aria-label), so it is not announced twice.
   */
  decorative?: boolean;
  /** Hover delay in ms. Keyboard focus shows the tooltip at once. */
  delay?: number;
  children: (props: TooltipTriggerProps) => ReactNode;
}

const GAP = 6;
const TRANSFORM: Record<TooltipSide, string> = {
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  right: 'translate(0, -50%)',
  left: 'translate(-100%, -50%)',
};

function anchorPoint(rect: DOMRect, side: TooltipSide): { left: number; top: number } {
  switch (side) {
    case 'right':
      return { left: rect.right + GAP, top: rect.top + rect.height / 2 };
    case 'left':
      return { left: rect.left - GAP, top: rect.top + rect.height / 2 };
    case 'bottom':
      return { left: rect.left + rect.width / 2, top: rect.bottom + GAP };
    case 'top':
      return { left: rect.left + rect.width / 2, top: rect.top - GAP };
  }
}

/** Keyboard focus only: a mouse click that focuses a button should not pop a tooltip. */
function isFocusVisible(element: HTMLElement): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * Short label shown on hover (after `delay`) and on keyboard focus; closes on pointer leave,
 * blur or Escape. Rendered in a portal with fixed positioning so panels never clip it.
 */
export function Tooltip({
  content,
  side = 'top',
  decorative = false,
  delay = 350,
  children,
}: TooltipProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const id = useId();

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setAnchor(null);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!anchor) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [anchor, hide]);

  useLayoutEffect(() => {
    setPos(anchor ? anchorPoint(anchor.getBoundingClientRect(), side) : null);
  }, [anchor, side]);

  const open = anchor !== null && pos !== null;
  return (
    <>
      {children({
        onPointerEnter: (event) => {
          const target = event.currentTarget;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setAnchor(target), delay);
        },
        onPointerLeave: hide,
        onFocus: (event) => {
          if (isFocusVisible(event.currentTarget)) setAnchor(event.currentTarget);
        },
        onBlur: hide,
        'aria-describedby': open && !decorative ? id : undefined,
      })}
      {anchor && pos
        ? createPortal(
            <span
              id={id}
              role={decorative ? undefined : 'tooltip'}
              aria-hidden={decorative || undefined}
              style={{ left: pos.left, top: pos.top, transform: TRANSFORM[side] }}
              className="pointer-events-none fixed z-[70] w-max max-w-xs rounded border border-line-strong bg-raised px-2 py-1 text-xs text-fg shadow-lg"
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

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
