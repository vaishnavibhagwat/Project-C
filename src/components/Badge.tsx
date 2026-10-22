import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';

export type BadgeTone = 'neutral' | 'accent' | 'positive' | 'negative' | 'warning';

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'border-line-strong text-muted',
  accent: 'border-accent/40 text-accent bg-accent/10',
  positive: 'border-pos/40 text-pos bg-pos/10',
  negative: 'border-neg/40 text-neg bg-neg/10',
  warning: 'border-warn/40 text-warn bg-warn/10',
};

/** Small uppercase status label. Always pairs colour with text. */
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
