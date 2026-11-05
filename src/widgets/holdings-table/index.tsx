import { memo, useCallback, useMemo, type ReactNode } from 'react';
import {
  DataTable,
  parseIdList,
  serializeSort,
  type DataTableColumn,
  type SortRule,
} from '@/components/DataTable';
import { Delta } from '@/components/Delta';
import { PORTFOLIO_ID } from '@/data/derive/portfolio';
import { generateStressHoldings } from '@/data/mock/stressHoldings';
import { useRealTimeData } from '@/data/queries';
import { applyPricesToHoldings } from '@/data/transformers';
import { portfolioPricesUrl } from '@/data/wsSimulator';
import { useSymbolDetail } from '@/hooks/useSymbolDetail';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatInrCompact, formatNumber } from '@/utils/format';
import { formatLocalPrice } from '@/utils/holdings';
import { istDateKey } from '@/utils/time';
import { publishWidgetEvent } from '@/utils/widgetEvents';
import { HOLDING_COLUMNS, holdingSort, totals } from './model';
import type { Holding, HoldingColumnId, HoldingsTableConfig, HoldingsTableData } from './types';

const PRICES_CHANNEL = portfolioPricesUrl(PORTFOLIO_ID);
const PAGE_SIZE_OPTION: Record<number, HoldingsTableConfig['pageSize']> = {
  0: 'all',
  25: '25',
  50: '50',
  100: '100',
};

type Renderers = Partial<Record<HoldingColumnId, (h: Holding) => ReactNode>>;

const RENDER: Renderers = {
  quantity: (h) => formatNumber(h.quantity),
  price: (h) => formatLocalPrice(h),
  marketValue: (h) => formatInrCompact(h.marketValue),
  dailyPnL: (h) => (
    <Delta value={h.dailyPnL} text={formatInrCompact(h.dailyPnL, true)} arrow={false} />
  ),
  dailyPnLPercent: (h) => <Delta value={h.dailyPnLPercent / 100} />,
  weight: (h) => `${h.weight.toFixed(2)}%`,
  name: (h) => <span className="block max-w-[220px] truncate text-muted">{h.name}</span>,
  sector: (h) => h.sector ?? <span className="text-subtle">—</span>,
};

function footerFor(rows: readonly Holding[]) {
  const t = totals(rows);
  return {
    ticker: 'Total',
    marketValue: formatInrCompact(t.marketValue),
    dailyPnL: <Delta value={t.dailyPnL} text={formatInrCompact(t.dailyPnL, true)} arrow={false} />,
    dailyPnLPercent: <Delta value={t.dailyPnLPercent / 100} />,
    weight: `${t.weight.toFixed(1)}%`,
  };
}

function HoldingsTable({
  instanceId,
  onConfigChange,
  data,
  config,
}: WidgetComponentProps<HoldingsTableConfig, HoldingsTableData>) {
  const detail = useSymbolDetail();
  // Live prices between polls: the latest quotes on the simulated WebSocket are laid over the
  // last response (only when newer than it), so the table moves with the tape.
  const { lastMessage, status } = useRealTimeData(PRICES_CHANNEL);
  const live = useMemo(() => {
    if (!lastMessage || Date.parse(lastMessage.sentAt) <= Date.parse(data.asOf)) {
      return data.holdings;
    }
    return applyPricesToHoldings(data.holdings, lastMessage);
  }, [data, lastMessage]);
  const mockCount = config.mockRows === 'off' ? 0 : Number(config.mockRows);
  const rows = useMemo(
    () => (mockCount > 0 ? generateStressHoldings(live, mockCount) : live),
    [live, mockCount],
  );

  const columns = useMemo<DataTableColumn<Holding>[]>(
    () =>
      HOLDING_COLUMNS.map((c) => {
        if (c.id !== 'ticker') return { ...c, render: RENDER[c.id] };
        return {
          ...c,
          render: (h: Holding) =>
            detail && mockCount === 0 ? (
              <button
                type="button"
                className="font-medium text-fg hover:underline"
                aria-label={`Open details for ${h.ticker}`}
                onClick={(e) => {
                  e.stopPropagation();
                  detail.openSymbol(h.ticker);
                }}
              >
                {h.ticker}
              </button>
            ) : (
              <span className="font-medium text-fg">{h.ticker}</span>
            ),
        };
      }),
    [detail, mockCount],
  );

  const sort = useMemo(() => holdingSort(config), [config]);
  const onSortChange = useCallback(
    (next: SortRule[]) => onConfigChange({ sort: serializeSort(next) }),
    [onConfigChange],
  );
  const columnOrder = useMemo(() => parseIdList(config.columnOrder), [config.columnOrder]);
  const hiddenColumns = useMemo(() => parseIdList(config.hiddenColumns), [config.hiddenColumns]);
  const onColumnOrderChange = useCallback(
    (order: string[]) => onConfigChange({ columnOrder: order.join(',') }),
    [onConfigChange],
  );
  const onHiddenColumnsChange = useCallback(
    (hidden: string[]) => onConfigChange({ hiddenColumns: hidden.join(',') }),
    [onConfigChange],
  );
  const onPageSizeChange = useCallback(
    (size: number) => onConfigChange({ pageSize: PAGE_SIZE_OPTION[size] ?? 'all' }),
    [onConfigChange],
  );

  // Hook point: other widgets react to the selected symbol (e.g. the pie chart highlights it).
  const onRowClick = useCallback(
    (h: Holding) =>
      publishWidgetEvent({
        type: 'SYMBOL_SELECTED',
        symbol: h.ticker,
        sourceInstanceId: instanceId,
      }),
    [instanceId],
  );
  const rowActionLabel = useCallback((h: Holding) => `Select ${h.ticker}`, []);
  const connected = status.state === 'connected';

  return (
    <DataTable<Holding>
      caption="Holdings"
      rows={rows}
      columns={columns}
      getRowId={(h) => h.holdingId}
      sort={sort}
      onSortChange={onSortChange}
      columnOrder={columnOrder}
      onColumnOrderChange={onColumnOrderChange}
      hiddenColumns={hiddenColumns}
      onHiddenColumnsChange={onHiddenColumnsChange}
      pageSize={config.pageSize === 'all' ? 0 : Number(config.pageSize)}
      onPageSizeChange={onPageSizeChange}
      onRowClick={onRowClick}
      rowActionLabel={rowActionLabel}
      footer={footerFor}
      exportFileName={`holdings-${istDateKey(Date.parse(data.asOf))}.csv`}
      toolbarStart={
        <>
          <span
            className={cx(
              'flex items-center gap-1 text-2xs',
              connected ? 'text-pos' : 'text-muted',
            )}
            title={
              connected
                ? 'Simulated WebSocket connected: prices update between polls'
                : 'Simulated WebSocket disconnected: polling every 10 s'
            }
          >
            <span aria-hidden="true">{connected ? '●' : '○'}</span>
            {connected ? 'Live' : 'Polling'}
          </span>
          {mockCount > 0 ? (
            <span
              className="rounded border border-warn px-1.5 text-2xs text-warn"
              title="Performance demo: generated rows; totals do not match the book"
            >
              Demo · {formatNumber(mockCount)} generated rows
            </span>
          ) : null}
        </>
      }
    />
  );
}

export default memo(HoldingsTable);
