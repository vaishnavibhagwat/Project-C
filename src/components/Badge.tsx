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

export type SentimentValue = 'positive' | 'negative' | 'neutral';

const SENTIMENT_BADGE: Record<SentimentValue, { tone: BadgeTone; mark: string; label: string }> = {
  positive: { tone: 'positive', mark: '▲', label: 'Positive' },
  negative: { tone: 'negative', mark: '▼', label: 'Negative' },
  neutral: { tone: 'neutral', mark: '■', label: 'Neutral' },
};

/** Sentiment as a badge: green, red or grey, always with a mark and a text label. */
export function SentimentBadge({
  sentiment,
  score,
  className,
}: {
  sentiment: SentimentValue;
  /** Optional score (−1 to 1), shown in the tooltip. */
  score?: number;
  className?: string;
}) {
  const s = SENTIMENT_BADGE[sentiment];
  return (
    <span
      title={score === undefined ? undefined : `Sentiment score ${score.toFixed(2)} (−1 to +1)`}
      className="inline-flex"
    >
      <Badge tone={s.tone} className={className}>
        <span aria-hidden="true" className="mr-0.5">
          {s.mark}
        </span>
        {s.label}
      </Badge>
    </span>
  );
}
