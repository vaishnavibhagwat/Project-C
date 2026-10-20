import { memo, useCallback, useMemo, useState } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { virtuosoTableComponents } from '@/components/charts';
import { Delta } from '@/components/Delta';
import { IconSearch } from '@/components/Icons';
import { EmptyState } from '@/components/StateViews';
import { useSymbolDetail } from '@/hooks/useSymbolDetail';
import { useWidgetStore } from '@/store/widgetStore';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatInr, formatInrCompact, formatNumber } from '@/utils/format';
import { selectHoldings, totals } from './model';
import type { Holding, HoldingSortKey, HoldingsTableConfig, HoldingsTableData } from './types';

interface Column {
  key: HoldingSortKey | 'name' | 'ltp' | 'quantity';
  label: string;
  numeric: boolean;
  /** Present for sortable columns. */
  sortKey?: HoldingSortKey;
  pnl?: boolean;
  minWidth?: number;
}

const COLUMNS: Column[] = [
  { key: 'symbol', label: 'Symbol', numeric: false, sortKey: 'symbol' },
  { key: 'quantity', label: 'Qty', numeric: true, minWidth: 720 },
  { key: 'ltp', label: 'LTP ₹', numeric: true },
  { key: 'dayChangePct', label: 'Day %', numeric: true, sortKey: 'dayChangePct' },
  {
    key: 'marketValueInr',
    label: 'Value',
    numeric: true,
    sortKey: 'marketValueInr',
    minWidth: 520,
  },
  { key: 'weightPct', label: 'Weight', numeric: true, sortKey: 'weightPct' },
  {
    key: 'dayPnlInr',
    label: 'Day P&L',
    numeric: true,
    sortKey: 'dayPnlInr',
    pnl: true,
    minWidth: 620,
  },
  {
    key: 'unrealisedPnlPct',
    label: 'Unreal. %',
    numeric: true,
    sortKey: 'unrealisedPnlPct',
    pnl: true,
    minWidth: 820,
  },
];

const TABLE_PARTS = virtuosoTableComponents<Holding>();

function Cell({ col, h }: { col: Column; h: Holding }) {
  switch (col.key) {
    case 'symbol':
      return (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium text-fg">{h.symbol}</span>
          <span className="truncate text-2xs text-subtle">{h.sector}</span>
        </span>
      );
    case 'quantity':
      return <>{formatNumber(h.quantity)}</>;
    case 'ltp':
      return <>{formatInr(h.ltp, 2).slice(1)}</>;
    case 'dayChangePct':
      return <Delta value={h.dayChangePct / 100} />;
    case 'marketValueInr':
      return <>{formatInrCompact(h.marketValueInr)}</>;
    case 'weightPct':
      return <>{h.weightPct.toFixed(2)}%</>;
    case 'dayPnlInr':
      return <Delta value={h.dayPnlInr} text={formatInrCompact(h.dayPnlInr, true)} arrow={false} />;
    case 'unrealisedPnlPct':
      return <Delta value={h.unrealisedPnlPct / 100} arrow={false} />;
    default:
      return null;
  }
}

function HoldingsTable({
  instanceId,
  data,
  config,
  width,
}: WidgetComponentProps<HoldingsTableConfig, HoldingsTableData>) {
  const updateConfig = useWidgetStore((s) => s.updateConfig);
  const detail = useSymbolDetail();
  const [query, setQuery] = useState('');
  const rows = useMemo(
    () => selectHoldings(data.holdings, config, query),
    [data.holdings, config, query],
  );
  const sum = useMemo(() => totals(rows), [rows]);
  const columns = useMemo(
    () =>
      COLUMNS.filter(
        (c) => (config.showPnl || !c.pnl) && (c.minWidth === undefined || width >= c.minWidth),
      ),
    [config.showPnl, width],
  );

  const onSort = useCallback(
    (key: HoldingSortKey) => {
      if (config.sortBy === key)
        updateConfig(instanceId, { sortDir: config.sortDir === 'asc' ? 'desc' : 'asc' });
      else updateConfig(instanceId, { sortBy: key, sortDir: key === 'symbol' ? 'asc' : 'desc' });
    },
    [config.sortBy, config.sortDir, instanceId, updateConfig],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
        <label className="relative flex-1">
          <span className="sr-only">Filter holdings by symbol or name</span>
          <IconSearch
            size={13}
            className="pointer-events-none absolute left-2 top-1.5 text-subtle"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter symbol or name"
            className="h-6 w-full rounded border border-line bg-bg pl-7 pr-2 text-xs text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <span className="num whitespace-nowrap text-2xs text-muted">
          {rows.length} of {data.holdings.length}
          {config.sector === 'All' ? '' : ` · ${config.sector}`}
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No holdings match"
          message="Clear the filter or choose another sector."
        />
      ) : (
        <TableVirtuoso
          className="scroll-thin min-h-0 flex-1"
          components={TABLE_PARTS}
          data={rows}
          computeItemKey={(_, h) => h.symbol}
          increaseViewportBy={120}
          fixedHeaderContent={() => (
            <tr className="bg-panel">
              {columns.map((c) => {
                const sortKey = c.sortKey;
                const sorted = sortKey !== undefined && config.sortBy === sortKey;
                const ariaSort = sorted
                  ? config.sortDir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={sortKey ? ariaSort : undefined}
                    className={cx(
                      'h-7 whitespace-nowrap border-b border-line px-2 text-2xs font-medium uppercase tracking-wide text-muted',
                      c.numeric ? 'text-right' : 'text-left',
                    )}
                  >
                    {sortKey ? (
                      <button
                        type="button"
                        onClick={() => onSort(sortKey)}
                        className={cx(
                          'inline-flex items-center gap-0.5 hover:text-fg',
                          sorted && 'text-fg',
                        )}
                      >
                        {c.label}
                        <span aria-hidden="true" className="text-[9px]">
                          {sorted ? (config.sortDir === 'asc' ? '▲' : '▼') : ''}
                        </span>
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          )}
          itemContent={(_, h) =>
            columns.map((c) => (
              <td
                key={c.key}
                className={cx(
                  'h-8 whitespace-nowrap border-b border-line px-2 text-xs',
                  c.numeric ? 'num text-right' : 'text-left',
                )}
              >
                {c.key === 'symbol' && detail ? (
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => detail.openSymbol(h.symbol)}
                  >
                    <Cell col={c} h={h} />
                  </button>
                ) : (
                  <Cell col={c} h={h} />
                )}
              </td>
            ))
          }
          fixedFooterContent={() => (
            <tr className="bg-raised">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cx(
                    'h-7 px-2 text-xs font-medium',
                    c.numeric ? 'num text-right' : 'text-left',
                  )}
                >
                  {c.key === 'symbol' ? 'Total' : null}
                  {c.key === 'marketValueInr' ? formatInrCompact(sum.marketValueInr) : null}
                  {c.key === 'weightPct' ? `${sum.weightPct.toFixed(1)}%` : null}
                  {c.key === 'dayPnlInr' ? (
                    <Delta
                      value={sum.dayPnlInr}
                      text={formatInrCompact(sum.dayPnlInr, true)}
                      arrow={false}
                    />
                  ) : null}
                </td>
              ))}
            </tr>
          )}
        />
      )}
    </div>
  );
}

export default memo(HoldingsTable);
