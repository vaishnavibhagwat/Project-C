import { memo, useCallback, useMemo } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { virtuosoTableComponents } from '@/components/charts';
import { Badge } from '@/components/Delta';
import { Segmented } from '@/components/FormControls';
import { EmptyState } from '@/components/StateViews';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatInrCompact, formatNumber } from '@/utils/format';
import { formatDateKey } from '@/utils/time';
import { filterTrades, flows } from './model';
import type { Trade, TradeBlotterConfig, TradeBlotterData } from './types';

type Side = TradeBlotterConfig['side'];

const TABLE_PARTS = virtuosoTableComponents<Trade>();

const STATUS_TONE = { Filled: 'accent', Settling: 'warning', Settled: 'neutral' } as const;

function TradeBlotter({
  onConfigChange,
  data,
  config,
  width,
}: WidgetComponentProps<TradeBlotterConfig, TradeBlotterData>) {
  const rows = useMemo(() => filterTrades(data.trades, config), [data.trades, config]);
  const f = useMemo(() => flows(rows), [rows]);
  const setSide = useCallback((side: Side) => onConfigChange({ side }), [onConfigChange]);
  const wide = width >= 640;

  const header = (
    <tr className="bg-panel text-2xs font-medium uppercase tracking-wide text-muted">
      <th scope="col" className="h-7 border-b border-line px-2 text-left">
        Time
      </th>
      <th scope="col" className="h-7 border-b border-line px-2 text-left">
        Symbol
      </th>
      <th scope="col" className="h-7 border-b border-line px-2 text-left">
        Side
      </th>
      <th scope="col" className="h-7 border-b border-line px-2 text-right">
        Qty
      </th>
      <th scope="col" className="h-7 border-b border-line px-2 text-right">
        Price ₹
      </th>
      {wide ? (
        <th scope="col" className="h-7 border-b border-line px-2 text-right">
          Value
        </th>
      ) : null}
      {config.showSettlement ? (
        <th scope="col" className="h-7 border-b border-line px-2 text-right">
          Settles (T+1)
        </th>
      ) : null}
      {wide ? (
        <th scope="col" className="h-7 border-b border-line px-2 text-left">
          Status
        </th>
      ) : null}
    </tr>
  );

  const row = (t: Trade) => (
    <>
      <td className="num h-8 whitespace-nowrap border-b border-line px-2 text-xs text-muted">
        {t.tradeDate === data.tradeDate
          ? t.time.slice(11, 19)
          : `${formatDateKey(t.tradeDate, false)} ${t.time.slice(11, 16)}`}
      </td>
      <td className="h-8 whitespace-nowrap border-b border-line px-2 text-xs font-medium text-fg">
        {t.symbol}
      </td>
      <td
        className={cx(
          'h-8 border-b border-line px-2 text-xs font-semibold',
          t.side === 'BUY' ? 'text-pos' : 'text-neg',
        )}
      >
        {t.side === 'BUY' ? '▲ BUY' : '▼ SELL'}
      </td>
      <td className="num h-8 border-b border-line px-2 text-right text-xs">
        {formatNumber(t.quantity)}
      </td>
      <td className="num h-8 border-b border-line px-2 text-right text-xs">{t.price.toFixed(2)}</td>
      {wide ? (
        <td className="num h-8 border-b border-line px-2 text-right text-xs">
          {formatInrCompact(t.valueInr)}
        </td>
      ) : null}
      {config.showSettlement ? (
        <td className="num h-8 whitespace-nowrap border-b border-line px-2 text-right text-xs text-muted">
          {formatDateKey(t.settlementDate, false)}
        </td>
      ) : null}
      {wide ? (
        <td className="h-8 border-b border-line px-2 text-xs">
          <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
        </td>
      ) : null}
    </>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5 text-xs">
        <dl className="num flex gap-3">
          <div className="flex gap-1">
            <dt className="text-muted">Buys</dt>
            <dd className="text-pos">{formatInrCompact(f.buy)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted">Sells</dt>
            <dd className="text-neg">{formatInrCompact(f.sell)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted">Net</dt>
            <dd>{formatInrCompact(f.net, true)}</dd>
          </div>
        </dl>
        <Segmented<Side>
          label="Trade side"
          value={config.side}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'BUY', label: 'Buys' },
            { value: 'SELL', label: 'Sells' },
          ]}
          onValueChange={setSide}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No trades match" message="Change the side or status filter." />
      ) : (
        <TableVirtuoso
          className="scroll-thin min-h-0 flex-1"
          components={TABLE_PARTS}
          data={rows}
          computeItemKey={(_, t) => t.id}
          fixedHeaderContent={() => header}
          itemContent={(_, t) => row(t)}
        />
      )}
    </div>
  );
}

export default memo(TradeBlotter);
