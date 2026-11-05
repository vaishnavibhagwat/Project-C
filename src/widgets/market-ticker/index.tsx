import { memo, useCallback, useMemo, useState } from 'react';
import { IconPause, IconPlay } from '@/components/Icons';
import { useNow } from '@/hooks/useNow';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import {
  crawlSeconds,
  directionOf,
  formatChange,
  formatPrice,
  nseStatus,
  quoteLabel,
  selectQuotes,
  sparkPoints,
  type MarketStatus,
} from './model';
import type { MarketTickerConfig, MarketTickerWidgetData, TickerQuote } from './types';

const STATUS_STYLE: Record<MarketStatus, { mark: string; className: string }> = {
  open: { mark: '●', className: 'border-pos/50 text-pos' },
  'pre-open': { mark: '◐', className: 'border-warn/50 text-warn' },
  closed: { mark: '○', className: 'border-line-strong text-muted' },
};
const ARROW = { up: '▲', down: '▼', flat: '■' } as const;
const TONE = { up: 'text-pos', down: 'text-neg', flat: 'text-muted' } as const;
const SPARK_W = 60;
const SPARK_H = 16;

function TickerItem({
  quote,
  expanded,
  onToggle,
  inert,
}: {
  quote: TickerQuote;
  expanded: boolean;
  onToggle: (symbol: string) => void;
  /** The duplicate copy that makes the loop seamless: hidden from assistive tech and Tab. */
  inert: boolean;
}) {
  const d = directionOf(quote.changePct);
  return (
    <li className="flex shrink-0 items-center">
      <button
        type="button"
        tabIndex={inert ? -1 : 0}
        aria-expanded={inert ? undefined : expanded}
        aria-label={
          inert ? undefined : `${quoteLabel(quote)} ${expanded ? 'Hide' : 'Show'} 30-day sparkline.`
        }
        title={quote.note}
        onClick={() => onToggle(quote.symbol)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-xs hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="font-medium text-fg">{quote.name}</span>
        <span className="num text-fg">{formatPrice(quote)}</span>
        <span className={cx('num', TONE[d])}>
          <span aria-hidden="true">{ARROW[d]} </span>
          {formatChange(quote.changePct)}
        </span>
        {expanded ? (
          <svg
            width={SPARK_W}
            height={SPARK_H}
            aria-hidden="true"
            data-testid={inert ? undefined : `spark-${quote.symbol}`}
          >
            <polyline
              points={sparkPoints(quote.history, SPARK_W, SPARK_H)}
              fill="none"
              stroke={cssColor(d === 'down' ? 'negative' : d === 'up' ? 'positive' : 'textMuted')}
              strokeWidth={1.25}
            />
          </svg>
        ) : null}
      </button>
      <span aria-hidden="true" className="px-1 text-subtle">
        ·
      </span>
    </li>
  );
}

function MarketTicker({
  data,
  config,
}: WidgetComponentProps<MarketTickerConfig, MarketTickerWidgetData>) {
  const quotes = useMemo(() => selectQuotes(data, config), [data, config]);
  const now = useNow(15_000);
  const status = nseStatus(now);
  const [paused, setPaused] = useState(false);
  // Keyboard focus inside the ticker: stop the crawl and show a plain scrolling row, so the
  // focused item is always in view (WCAG 2.4.11) rather than paused half off-screen.
  const [focusInside, setFocusInside] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback((symbol: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }, []);
  const seconds = crawlSeconds(quotes.length, config.speed);
  const s = STATUS_STYLE[status.status];
  const copy = (inert: boolean) =>
    quotes.map((q) => (
      <TickerItem
        key={`${inert ? 'b' : 'a'}-${q.symbol}`}
        quote={q}
        expanded={expanded.has(q.symbol)}
        onToggle={toggle}
        inert={inert}
      />
    ));

  return (
    <div className="flex h-full items-center gap-2 px-2">
      <span
        className={cx(
          'inline-flex shrink-0 items-center gap-1 rounded border px-1.5 text-2xs font-semibold uppercase tracking-wide',
          s.className,
        )}
        title="NSE session from the IST clock: pre-open 09:00–09:15, open 09:15–15:30"
      >
        <span aria-hidden="true">{s.mark}</span>
        NSE {status.label}
      </span>
      <button
        type="button"
        aria-pressed={paused}
        aria-label={paused ? 'Play the ticker' : 'Pause the ticker'}
        onClick={() => setPaused((p) => !p)}
        className="shrink-0 rounded border border-line p-1 text-muted hover:bg-raised hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus motion-reduce:hidden"
      >
        {paused ? (
          <IconPlay size={12} aria-hidden="true" />
        ) : (
          <IconPause size={12} aria-hidden="true" />
        )}
      </button>
      {/* Moving content pauses on hover and focus as well as with the button (WCAG 2.2.2).
          Under prefers-reduced-motion it does not move at all and scrolls instead. */}
      <div
        className={cx(
          'group relative min-w-0 flex-1 motion-reduce:overflow-x-auto',
          focusInside ? 'scroll-thin overflow-x-auto' : 'overflow-hidden',
        )}
        onFocus={() => setFocusInside(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setFocusInside(false);
        }}
        role="region"
        aria-label="Market ticker"
        aria-roledescription="ticker"
      >
        <div
          data-testid="ticker-track"
          data-paused={paused ? 'true' : 'false'}
          data-static={focusInside ? 'true' : 'false'}
          className={cx(
            'flex w-max motion-reduce:animate-none',
            focusInside
              ? 'animate-none'
              : 'animate-ticker-crawl group-hover:[animation-play-state:paused]',
          )}
          style={{
            animationDuration: `${seconds}s`,
            animationPlayState: paused ? 'paused' : undefined,
          }}
        >
          <ul className="flex shrink-0" aria-label="Instruments">
            {copy(false)}
          </ul>
          <ul
            className={cx('flex shrink-0 motion-reduce:hidden', focusInside && 'hidden')}
            aria-hidden="true"
          >
            {copy(true)}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default memo(MarketTicker);
