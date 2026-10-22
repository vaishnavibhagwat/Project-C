import { useMemo } from 'react';
import { Delta } from '@/components/Delta';
import { Modal } from '@/components/Overlay';
import { getDataset } from '@/data/dataset';
import { findConstituent, NIFTY50 } from '@/data/nifty50';
import { useEndpoint } from '@/hooks/useEndpoint';
import { cssColor } from '@/theme/themes';
import { formatInr, formatInrCompact, formatNumber, formatPct } from '@/utils/format';
import { unrealisedPnL, unrealisedPnLPercent } from '@/utils/holdings';
import { formatDateKey } from '@/utils/time';

const W = 520;
const H = 120;

/** One-year close sparkline drawn as a plain SVG polyline (no chart library in the main bundle). */
function PriceLine({ closes }: { closes: number[] }) {
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const pts = closes
    .map(
      (c, i) =>
        `${((i / (closes.length - 1)) * W).toFixed(1)},${(H - ((c - min) / (max - min || 1)) * H).toFixed(1)}`,
    )
    .join(' ');
  const up = (closes[closes.length - 1] ?? 0) >= (closes[0] ?? 0);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-28 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
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

/** Detail panel for a Nifty 50 symbol: 1Y simulated closes plus the fund's position. */
export function SymbolDetail({ symbol, onClose }: { symbol: string | null; onClose: () => void }) {
  const holdings = useEndpoint('portfolio/holdings', 5000, symbol !== null);
  const constituent = symbol ? findConstituent(symbol) : undefined;
  const series = useMemo(() => {
    if (!constituent) return null;
    const ds = getDataset();
    const index = NIFTY50.indexOf(constituent);
    const closes = (ds.stockCloses[index] ?? []).slice(-253);
    const dates = ds.dates.slice(-253);
    return { closes, from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' };
  }, [constituent]);
  const holding = holdings.data?.holdings.find((h) => h.ticker === symbol);
  const first = series?.closes[0] ?? 0;
  const last = series?.closes[series.closes.length - 1] ?? 0;

  return (
    <Modal
      open={symbol !== null}
      onClose={onClose}
      title={constituent ? `${constituent.symbol} · ${constituent.name}` : 'Symbol'}
      description={constituent ? `${constituent.sector} · NSE · simulated prices` : undefined}
    >
      {constituent && series ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <span className="num text-xl font-semibold text-fg">
              {formatInr(holding?.currentPrice ?? last)}
            </span>
            {holding ? <Delta value={holding.dailyPnLPercent / 100} /> : null}
            <span className="text-xs text-muted">1Y</span>
            <Delta value={first === 0 ? 0 : last / first - 1} />
          </div>
          <div>
            <PriceLine closes={series.closes} />
            <div className="num flex justify-between text-2xs text-subtle">
              <span>{formatDateKey(series.from)}</span>
              <span>{formatDateKey(series.to)}</span>
            </div>
          </div>
          {holding ? (
            <dl className="num grid grid-cols-2 gap-x-6 gap-y-1 rounded border border-line p-3 text-xs sm:grid-cols-3">
              {[
                ['Quantity', formatNumber(holding.quantity)],
                ['Avg cost', formatInr(holding.averageCost)],
                ['Market value', formatInrCompact(holding.marketValue)],
                ['Weight (equity)', `${holding.weight.toFixed(2)}%`],
                ['Day P&L', formatInrCompact(holding.dailyPnL, true)],
                [
                  'Unrealised',
                  `${formatInrCompact(unrealisedPnL(holding), true)} (${formatPct(unrealisedPnLPercent(holding) / 100)})`,
                ],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <dt className="text-2xs uppercase tracking-wide text-muted">{k}</dt>
                  <dd className="text-fg">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="rounded border border-line p-3 text-xs text-muted">
              {holdings.isPending
                ? 'Loading position…'
                : 'The fund holds no position in this constituent.'}{' '}
              Index weight {constituent.indexWeight.toFixed(2)}% (approximate).
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">Unknown symbol.</p>
      )}
    </Modal>
  );
}
