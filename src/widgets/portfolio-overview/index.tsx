import { memo, type ReactNode } from 'react';
import { Delta } from '@/components/Delta';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatInrCompact, formatMoneyCompact, formatUsdCompact } from '@/utils/format';
import type { PortfolioOverviewConfig, PortfolioOverviewData } from './types';

function Tile({
  label,
  value,
  sub,
  title,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  title?: string;
}) {
  return (
    <div
      className="flex min-w-0 flex-col justify-center gap-0.5 border-l border-line px-3 first:border-l-0"
      title={title}
    >
      <span className="truncate text-2xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="num truncate text-lg font-semibold leading-tight text-fg">{value}</span>
      {sub ? <span className="num truncate text-2xs text-muted">{sub}</span> : null}
    </div>
  );
}

function PortfolioOverview({
  data,
  config,
  width,
}: WidgetComponentProps<PortfolioOverviewConfig, PortfolioOverviewData>) {
  const fx = data.fxUsdInr;
  const money = (inr: number, signed = false) =>
    formatMoneyCompact(inr, config.currency, fx, signed);
  const secondary = (inr: number) =>
    config.currency === 'INR' ? formatUsdCompact(inr / fx) : formatInrCompact(inr);
  const narrow = width > 0 && width < 560;

  return (
    <div
      className={cx(
        'grid h-full items-stretch py-1',
        narrow ? 'grid-cols-2 gap-y-2' : 'grid-flow-col auto-cols-fr',
      )}
    >
      <Tile
        label="AUM · last close"
        value={
          config.currency === 'USD' ? formatUsdCompact(data.aumUsd) : formatInrCompact(data.aumInr)
        }
        sub={
          config.currency === 'USD' ? formatInrCompact(data.aumInr) : formatUsdCompact(data.aumUsd)
        }
        title="Official AUM at the last NSE close. Intraday value moves with simulated prices."
      />
      <Tile
        label="Intraday value"
        value={money(data.marketValueInr)}
        sub={secondary(data.marketValueInr)}
      />
      <Tile
        label="Day P&L"
        value={<Delta value={data.dayPnlInr} text={money(data.dayPnlInr, true)} />}
        sub={<Delta value={data.dayChangePct / 100} arrow={false} />}
      />
      <Tile
        label="NAV / unit"
        value={`₹${data.navPerUnit.toFixed(2)}`}
        sub={
          <span>
            Last close <Delta value={data.navDayChangePct / 100} arrow={false} />
          </span>
        }
      />
      {config.showReturns ? (
        <>
          <Tile label="MTD" value={<Delta value={data.mtdReturnPct / 100} />} />
          <Tile label="YTD" value={<Delta value={data.ytdReturnPct / 100} />} />
          <Tile label="1 year" value={<Delta value={data.oneYearReturnPct / 100} />} />
        </>
      ) : null}
      {config.showBenchmark ? (
        <Tile
          label="Nifty 50 today"
          value={<Delta value={data.benchmarkDayChangePct / 100} />}
          sub={
            <span>
              Equity {data.equityWeightPct.toFixed(1)}% · Cash {data.cashWeightPct.toFixed(1)}%
            </span>
          }
        />
      ) : null}
    </div>
  );
}

export default memo(PortfolioOverview);
