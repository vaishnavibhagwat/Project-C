import { useNow } from '@/hooks/useNow';
import { env } from '@/utils/env';
import { cx } from '@/utils/cx';
import { formatIstTime, getNseSession } from '@/utils/time';

/** NSE session phase (real IST clock) and whether simulated ticks run outside hours. */
export function MarketStatus() {
  const now = useNow(1000);
  const session = getNseSession(now);
  const tone =
    session.phase === 'open' ? 'bg-pos' : session.phase === 'pre-open' ? 'bg-warn' : 'bg-subtle';
  const extended = session.phase !== 'open' && env.VITE_SIMULATE_MARKET_OPEN;
  return (
    <div
      className="flex items-center gap-2 text-xs"
      title={session.nextChange ? `Next change ${session.nextChange}` : undefined}
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className={cx('h-1.5 w-1.5 rounded-full', tone)} />
        <span className="font-medium text-fg">NSE</span>
        <span className="text-muted">{session.label}</span>
      </span>
      {extended ? (
        <span className="hidden text-2xs text-warn lg:inline">· simulated ticks</span>
      ) : null}
      <span className="num text-muted" aria-label={`Time ${formatIstTime(now)}`}>
        {formatIstTime(now)}
      </span>
    </div>
  );
}
