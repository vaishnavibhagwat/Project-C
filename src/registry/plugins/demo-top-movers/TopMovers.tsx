import { memo, useMemo } from 'react';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatInrCompact, formatPctPoints } from '@/utils/format';
import { topMovers } from './model';
import type { Mover, TopMoversConfig, TopMoversData } from './types';

function MoverList({
  title,
  rows,
  tone,
  scale,
  rankBy,
}: {
  title: string;
  rows: readonly Mover[];
  tone: 'pos' | 'neg';
  scale: number;
  rankBy: TopMoversConfig['rankBy'];
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-1 flex-col gap-1">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-subtle">None today.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {rows.map((m) => {
            const value = rankBy === 'percent' ? Math.abs(m.dailyPnLPercent) : Math.abs(m.dailyPnL);
            const width = scale > 0 ? Math.max(4, (value / scale) * 100) : 0;
            return (
              <li key={m.holdingId} className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-fg">{m.ticker}</span>
                  <span className="min-w-0 flex-1 truncate text-2xs text-subtle">{m.name}</span>
                  <span className={cx('num', tone === 'pos' ? 'text-pos' : 'text-neg')}>
                    {formatPctPoints(m.dailyPnLPercent, 2, true)}
                  </span>
                  <span className="num w-20 text-right text-2xs text-muted">
                    {formatInrCompact(m.dailyPnL, true)}
                  </span>
                </div>
                <div className="h-1 rounded bg-raised" aria-hidden="true">
                  <div
                    className={cx('h-1 rounded', tone === 'pos' ? 'bg-pos' : 'bg-neg')}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Demo third-party widget: the day's biggest gainers and losers of the book. */
function TopMovers({ data, config, width }: WidgetComponentProps<TopMoversConfig, TopMoversData>) {
  const lists = useMemo(() => topMovers(data, config), [data, config]);
  const scale = Math.max(
    0,
    ...[...lists.gainers, ...lists.losers].map((m) =>
      config.rankBy === 'percent' ? Math.abs(m.dailyPnLPercent) : Math.abs(m.dailyPnL),
    ),
  );
  return (
    <div className="flex h-full flex-col">
      <div
        className={cx(
          'scroll-thin flex min-h-0 flex-1 gap-4 overflow-y-auto px-3 py-2',
          width < 420 && 'flex-col gap-3',
        )}
      >
        <MoverList
          title="Gainers"
          rows={lists.gainers}
          tone="pos"
          scale={scale}
          rankBy={config.rankBy}
        />
        <MoverList
          title="Losers"
          rows={lists.losers}
          tone="neg"
          scale={scale}
          rankBy={config.rankBy}
        />
      </div>
      <p className="border-t border-line px-3 py-1 text-2xs text-subtle">
        Demo plugin · registered at runtime · ranked by{' '}
        {config.rankBy === 'percent' ? 'day % move' : 'day P&L'}
      </p>
    </div>
  );
}

export default memo(TopMovers);
