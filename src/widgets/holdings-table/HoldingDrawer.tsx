import { useMemo, type ReactNode } from 'react';
import { SentimentBadge } from '@/components/Badge';
import { Delta } from '@/components/Delta';
import { Drawer } from '@/components/Overlay';
import { useEndpoint } from '@/hooks/useEndpoint';
import { cssColor } from '@/theme/themes';
import { formatInrCompact, formatNumber } from '@/utils/format';
import { formatLocalPrice } from '@/utils/holdings';
import { formatIstTime, formatDateKey } from '@/utils/time';
import type { Holding } from './types';

/** NSE ticker of a depositary receipt's underlying, for related news. */
const UNDERLYING: Record<string, string> = {
  'INFY US': 'INFY',
  'HDB US': 'HDFCBANK',
  'IBN US': 'ICICIBANK',
  'WIT US': 'WIPRO',
  'RDY US': 'DRREDDY',
  'RIGD LI': 'RELIANCE',
};

const SPARK_W = 280;
const SPARK_H = 56;

function Sparkline({ closes }: { closes: readonly number[] }) {
  if (closes.length < 2) return <p className="text-xs text-muted">No price history.</p>;
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const span = hi - lo || 1;
  const pts = closes
    .map((c, i) => {
      const x = (i / (closes.length - 1)) * SPARK_W;
      const y = SPARK_H - ((c - lo) / span) * (SPARK_H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const up = (closes[closes.length - 1] ?? 0) >= (closes[0] ?? 0);
  return (
    <svg
      width="100%"
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Price over ${closes.length} trading days, ${up ? 'up' : 'down'} overall`}
      data-testid="holding-sparkline"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={cssColor(up ? 'positive' : 'negative')}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Detail drawer for one holding: price history, position, P&L, weight and related news. */
export function HoldingDrawer({
  holding,
  onClose,
}: {
  holding: Holding | null;
  onClose: () => void;
}) {
  const history = useEndpoint('portfolio/holding-history', 60_000, holding !== null, 'normal');
  const news = useEndpoint('market/news', 20_000, holding !== null, 'normal');
  const research = useEndpoint('research/feed', 60_000, holding !== null, 'normal');

  const closes = useMemo(
    () => history.data?.holdings.find((h) => h.holdingId === holding?.holdingId)?.closes ?? [],
    [history.data, holding],
  );
  const related = useMemo(() => {
    if (!holding) return [];
    const tickers = new Set([holding.ticker, UNDERLYING[holding.ticker] ?? holding.ticker]);
    return [...(news.data?.articles ?? []), ...(research.data?.articles ?? [])]
      .filter((a) => a.relevantTickers.some((t) => tickers.has(t)))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 5);
  }, [holding, news.data, research.data]);

  const fields: [string, ReactNode][] = holding
    ? [
        ['Quantity', formatNumber(holding.quantity)],
        ['Price', formatLocalPrice(holding)],
        [
          'Average cost',
          `${holding.currency === 'INR' ? '₹' : '$'}${holding.averageCost.toFixed(2)}`,
        ],
        ['Market value', formatInrCompact(holding.marketValue)],
        ['Weight', `${holding.weight.toFixed(2)}% of the book`],
        [
          'Day P&L',
          <Delta
            key="d"
            value={holding.dailyPnL}
            text={`${formatInrCompact(holding.dailyPnL, true)} (${holding.dailyPnLPercent >= 0 ? '+' : '−'}${Math.abs(holding.dailyPnLPercent).toFixed(2)}%)`}
          />,
        ],
        [
          'Unrealised P&L',
          <Delta
            key="u"
            value={holding.unrealisedPnL}
            text={formatInrCompact(holding.unrealisedPnL, true)}
          />,
        ],
        ['Asset class', holding.assetClass],
        ['Sector', holding.sector ?? '—'],
        ['Instrument', `${holding.instrumentType} · ${holding.geography} · ${holding.currency}`],
      ]
    : [];

  return (
    <Drawer
      open={holding !== null}
      onClose={onClose}
      title={holding ? `${holding.ticker} · ${holding.name}` : 'Holding'}
      description="Simulated position from the demo portfolio model."
    >
      {holding ? (
        <div className="flex flex-col gap-4 text-sm">
          <section aria-label="Price history">
            <h3 className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">
              Price, last {closes.length} trading days
            </h3>
            <Sparkline closes={closes} />
          </section>
          <section aria-label="Position">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {fields.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted">{label}</dt>
                  <dd className="num text-right text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-label="Related news">
            <h3 className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">
              Related news and research
            </h3>
            {related.length === 0 ? (
              <p className="text-xs text-muted">No recent stories mention this holding.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {related.map((a) => (
                  <li key={a.articleId} className="text-xs">
                    <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted">
                      <time dateTime={a.publishedAt}>
                        {formatDateKey(a.publishedAt.slice(0, 10), false)},{' '}
                        {formatIstTime(Date.parse(a.publishedAt), false)}
                      </time>
                      <span>{a.source}</span>
                      <SentimentBadge sentiment={a.sentiment} />
                    </div>
                    <p className="text-fg">{a.headline}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-2xs text-subtle">Sample research content: simulated stories.</p>
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
