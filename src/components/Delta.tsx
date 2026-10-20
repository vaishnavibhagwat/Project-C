import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';
import { direction, directionArrow, formatPct } from '@/utils/format';

export interface DeltaProps {
  /** Change as a fraction (0.0123 = +1.23%). */
  value: number;
  /** Optional pre-formatted text; defaults to a signed percentage. */
  text?: string;
  digits?: number;
  className?: string;
  /** Hide the arrow when space is tight; the +/- sign still conveys direction. */
  arrow?: boolean;
}

/** Signed change with arrow and colour. Direction is never conveyed by colour alone. */
export function Delta({ value, text, digits = 2, className, arrow = true }: DeltaProps) {
  const d = direction(value);
  return (
    <span
      className={cx(
        'num inline-flex items-center gap-0.5 whitespace-nowrap',
        d === 'up' && 'text-pos',
        d === 'down' && 'text-neg',
        d === 'flat' && 'text-muted',
        className,
      )}
    >
      {arrow ? (
        <span aria-hidden="true" className="text-[0.7em]">
          {directionArrow(value)}
        </span>
      ) : null}
      {text ?? formatPct(value, digits)}
    </span>
  );
}

export interface BadgeProps {
  tone?: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning';
  children: ReactNode;
  className?: string;
}

const BADGE_TONES = {
  neutral: 'border-line-strong text-muted',
  accent: 'border-accent/40 text-accent bg-accent/10',
  positive: 'border-pos/40 text-pos bg-pos/10',
  negative: 'border-neg/40 text-neg bg-neg/10',
  warning: 'border-warn/40 text-warn bg-warn/10',
} as const;

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex h-5 items-center whitespace-nowrap rounded-sm border px-1.5 text-2xs font-semibold uppercase tracking-wide',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
