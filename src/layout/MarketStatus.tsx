import { useNow } from '@/hooks/useNow';
import { env } from '@/utils/env';
import { cx } from '@/utils/cx';
import { formatIstTime, getNseSession } from '@/utils/time';

/**
 * NSE session pill. The phase comes from the IST clock and the NSE calendar; prices are always
 * simulated, and with VITE_SIMULATE_MARKET_OPEN the tape keeps ticking outside hours.
 */
export function MarketStatus() {
  const now = useNow(1000);
  const session = getNseSession(now);
  const dot =
    session.phase === 'open' ? 'bg-pos' : session.phase === 'pre-open' ? 'bg-warn' : 'bg-subtle';
  const extended = session.phase !== 'open' && env.VITE_SIMULATE_MARKET_OPEN;
  const detail = [
    `NSE ${session.label}`,
    session.nextChange ? `next change ${session.nextChange}` : null,
    extended ? 'simulated ticks continue outside hours' : 'prices are simulated',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div
      role="status"
      aria-label={detail}
      title={detail}
      className="flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-2 text-xs"
    >
      <span aria-hidden="true" className={cx('h-1.5 w-1.5 rounded-full', dot)} />
      <span className="font-medium text-fg">NSE</span>
      <span className="text-muted">{session.label}</span>
      {extended ? <span className="hidden text-2xs text-warn xl:inline">· sim ticks</span> : null}
      <span aria-hidden="true" className="num text-subtle">
        {formatIstTime(now)}
      </span>
    </div>
  );
}
