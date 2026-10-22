import { useMemo, type ReactNode } from 'react';
import { Button } from '@/components/Button';
import { IconAlert, IconRefresh, IconWifiOff } from '@/components/Icons';
import { InfoTooltip } from '@/components/Tooltip';
import { LIMITS } from '@/data/derive/alerts';
import { useConnection } from '@/hooks/useConnection';
import { useEndpoint } from '@/hooks/useEndpoint';
import { cx } from '@/utils/cx';
import { env } from '@/utils/env';
import { direction, directionArrow } from '@/utils/format';
import { formatIstTime } from '@/utils/time';
import {
  buildSummaryTiles,
  toSummaryStripData,
  type SummaryChange,
  type SummaryStripData,
  type SummaryTile,
} from './summaryStrip';

const TILE_COUNT = 8;
// A 1 px gap over the border colour draws hairline dividers at 2, 4 or 8 columns alike.
const GRID = 'grid grid-cols-2 gap-px bg-line sm:grid-cols-4 2xl:grid-cols-8';
const CELL = 'flex min-w-0 flex-col gap-0.5 bg-panel px-3 py-2';

function toneClass(amount: number, goodWhen: SummaryChange['goodWhen']): string {
  const d = direction(amount);
  if (d === 'flat') return 'text-muted';
  return d === goodWhen ? 'text-pos' : 'text-neg';
}

function Arrow({ amount }: { amount: number }) {
  return (
    <span aria-hidden="true" className="text-[0.7em]">
      {directionArrow(amount)}
    </span>
  );
}

function Tile({ tile }: { tile: SummaryTile }) {
  const { value, comparison } = tile;
  const change = comparison.change;
  return (
    <div className={CELL} data-metric={tile.id}>
      <dt className="flex items-center gap-1 text-2xs font-medium uppercase tracking-wide text-muted">
        <span className="truncate">{tile.label}</span>
        <InfoTooltip content={tile.tooltip} label={`About ${tile.label}`} />
      </dt>
      <dd
        className={cx(
          'num flex items-center gap-1 truncate text-lg font-semibold leading-tight',
          value.signed === undefined ? 'text-fg' : toneClass(value.signed, 'up'),
        )}
      >
        {value.signed === undefined ? null : <Arrow amount={value.signed} />}
        {value.text}
      </dd>
      <dd className="num flex min-w-0 items-center gap-1 text-2xs text-muted">
        {change ? (
          <span
            className={cx(
              'inline-flex shrink-0 items-center gap-0.5',
              toneClass(change.amount, change.goodWhen),
            )}
          >
            <Arrow amount={change.amount} />
            <span className="sr-only">
              {direction(change.amount) === 'up' ? 'higher' : 'lower'}:{' '}
            </span>
            {change.text}
          </span>
        ) : null}
        <span className="truncate">{comparison.text}</span>
      </dd>
    </div>
  );
}

function SkeletonTile() {
  return (
    <div className={CELL}>
      <div className="skeleton h-3 w-16" />
      <div className="skeleton mt-1 h-5 w-24" />
      <div className="skeleton mt-1 h-3 w-28" />
    </div>
  );
}

export interface PortfolioSummaryStripViewProps {
  /** Undefined while loading (skeleton) or when nothing has loaded yet. */
  data: SummaryStripData | undefined;
  /** First-load error, shown when there is no data to keep on screen. */
  error?: Error | null;
  /** The simulated feed is down and nothing has loaded yet. */
  disconnected?: boolean;
  onRetry?: () => void;
}

/**
 * Eight headline metrics in one dense strip: value (tabular figures), comparison period,
 * signed change with arrow, emerald or coral by whether the change is good news, and a tooltip
 * explaining each metric. Shows a shaped skeleton until data arrives.
 */
export function PortfolioSummaryStripView({
  data,
  error = null,
  disconnected = false,
  onRetry,
}: PortfolioSummaryStripViewProps) {
  const tiles = useMemo(() => (data ? buildSummaryTiles(data) : null), [data]);
  const asOf = data ? formatIstTime(Date.parse(data.asOf)) : null;

  let body: ReactNode;
  if (tiles) {
    body = (
      <dl className={GRID}>
        {tiles.map((tile) => (
          <Tile key={tile.id} tile={tile} />
        ))}
      </dl>
    );
  } else if (error || disconnected) {
    body = (
      <div role="alert" className="flex items-center gap-2 px-3 py-3 text-xs text-muted">
        {disconnected ? (
          <IconWifiOff size={14} className="text-warn" />
        ) : (
          <IconAlert size={14} className="text-neg" />
        )}
        <span className="min-w-0 flex-1 truncate">
          {disconnected
            ? 'Feed disconnected. The summary loads when it reconnects.'
            : `Couldn’t load the portfolio summary: ${error?.message ?? 'unknown error'}`}
        </span>
        {onRetry && !disconnected ? (
          <Button size="sm" icon={IconRefresh} onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  } else {
    body = (
      <div aria-hidden="true" className={GRID}>
        {Array.from({ length: TILE_COUNT }, (_, i) => (
          <SkeletonTile key={i} />
        ))}
      </div>
    );
  }

  return (
    <section
      aria-label={asOf ? `Portfolio summary, as of ${asOf}` : 'Portfolio summary'}
      aria-busy={!tiles && !error && !disconnected}
      className="mb-2 overflow-hidden rounded border border-line bg-panel"
    >
      {body}
    </section>
  );
}

/** Same endpoints, intervals and cache as the overview, risk-metrics and VaR widgets. */
export function usePortfolioSummaryStrip() {
  const summary = useEndpoint('portfolio/summary', 5000, true, 'low');
  const metrics = useEndpoint('risk/metrics', env.VITE_DATA_REFRESH_INTERVAL, true, 'high');
  const risk = useEndpoint('risk/var', env.VITE_DATA_REFRESH_INTERVAL, true, 'high');
  const data = useMemo(
    () =>
      summary.data && metrics.data && risk.data
        ? toSummaryStripData(summary.data, metrics.data, risk.data, LIMITS.var99Critical)
        : undefined,
    [summary.data, metrics.data, risk.data],
  );
  const queries = [summary, metrics, risk];
  return {
    data,
    error: queries.find((q) => q.error)?.error ?? null,
    refetch: () => {
      for (const q of queries) void q.refetch();
    },
  };
}

/** The strip at the top of the Workstation, wired to the shared mock dataset. */
export function PortfolioSummaryStrip() {
  const { data, error, refetch } = usePortfolioSummaryStrip();
  const connection = useConnection();
  return (
    <PortfolioSummaryStripView
      data={data}
      error={data ? null : error}
      disconnected={!data && !connection.connected}
      onRetry={refetch}
    />
  );
}
