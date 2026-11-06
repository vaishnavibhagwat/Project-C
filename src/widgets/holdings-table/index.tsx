import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
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
import { Select } from '@/components/Select';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatInrCompact, formatNumber } from '@/utils/format';
import { formatLocalPrice } from '@/utils/holdings';
import { istDateKey } from '@/utils/time';
import { publishWidgetEvent } from '@/utils/widgetEvents';
import { HoldingDrawer } from './HoldingDrawer';
import { activeFilterCount, filterHoldings, HOLDING_COLUMNS, holdingSort, totals } from './model';
import {
  ASSET_CLASS_FILTERS,
  PNL_FILTERS,
  SECTOR_FILTERS,
  type Holding,
  type HoldingColumnId,
  type HoldingsTableConfig,
  type HoldingsTableData,
} from './types';

const SECTOR_OPTIONS = SECTOR_FILTERS.map((v) => ({
  value: v,
  label: v === 'all' ? 'All sectors' : v === 'none' ? 'No sector' : v,
}));
const CLASS_OPTIONS = ASSET_CLASS_FILTERS.map((v) => ({
  value: v,
  label: v === 'all' ? 'All classes' : v,
}));
const PNL_OPTIONS = PNL_FILTERS.map((v) => ({
  value: v,
  label: v === 'all' ? 'Any P&L' : v === 'gainers' ? 'Gainers' : 'Losers',
}));

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
  const all = useMemo(
    () => (mockCount > 0 ? generateStressHoldings(live, mockCount) : live),
    [live, mockCount],
  );
  const rows = useMemo(() => filterHoldings(all, config), [all, config]);
  const filters = activeFilterCount(config);

  // Row selection (not saved) and the detail drawer.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedRows = useMemo(() => all.filter((h) => selected.has(h.holdingId)), [all, selected]);
  const selectedTotals = useMemo(() => totals(selectedRows), [selectedRows]);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const drawerHolding = drawerId ? (all.find((h) => h.holdingId === drawerId) ?? null) : null;

  const columns = useMemo<DataTableColumn<Holding>[]>(
    () =>
      HOLDING_COLUMNS.map((c) =>
        c.id === 'ticker'
          ? {
              ...c,
              render: (h: Holding) => <span className="font-medium text-fg">{h.ticker}</span>,
            }
          : { ...c, render: RENDER[c.id] },
      ),
    [],
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

  // A row opens its detail drawer and tells other widgets (pie chart, news feed) the symbol.
  const onRowClick = useCallback(
    (h: Holding) => {
      if (mockCount === 0) setDrawerId(h.holdingId);
      publishWidgetEvent({
        type: 'SYMBOL_SELECTED',
        symbol: h.ticker,
        sourceInstanceId: instanceId,
      });
    },
    [instanceId, mockCount],
  );
  const rowActionLabel = useCallback((h: Holding) => `Open ${h.ticker} details`, []);
  const selectLabel = useCallback((h: Holding) => `Select ${h.ticker}`, []);
  const connected = status.state === 'connected';

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-1 text-2xs">
        <span className="text-muted">Filter</span>
        <Select<HoldingsTableConfig['filterSector']>
          label="Sector"
          hideLabel
          value={config.filterSector}
          options={SECTOR_OPTIONS}
          onValueChange={(filterSector) => onConfigChange({ filterSector })}
        />
        <Select<HoldingsTableConfig['filterAssetClass']>
          label="Asset class"
          hideLabel
          value={config.filterAssetClass}
          options={CLASS_OPTIONS}
          onValueChange={(filterAssetClass) => onConfigChange({ filterAssetClass })}
        />
        <Select<HoldingsTableConfig['filterPnl']>
          label="Day P&L"
          hideLabel
          value={config.filterPnl}
          options={PNL_OPTIONS}
          onValueChange={(filterPnl) => onConfigChange({ filterPnl })}
        />
        {filters > 0 ? (
          <button
            type="button"
            className="rounded px-1 text-muted underline hover:text-fg"
            onClick={() =>
              onConfigChange({ filterSector: 'all', filterAssetClass: 'all', filterPnl: 'all' })
            }
          >
            Clear filters ({filters})
          </button>
        ) : null}
        {selected.size > 0 ? (
          <span
            role="status"
            className="ml-auto flex items-center gap-1.5 rounded border border-accent/50 px-1.5 text-fg"
          >
            {selected.size} selected · {formatInrCompact(selectedTotals.marketValue)} ·{' '}
            {selectedTotals.weight.toFixed(1)}% · day{' '}
            <Delta
              value={selectedTotals.dailyPnL}
              text={formatInrCompact(selectedTotals.dailyPnL, true)}
              arrow={false}
            />
            <button
              type="button"
              className="text-muted underline hover:text-fg"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
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
          selectedIds={mockCount === 0 ? selected : undefined}
          onSelectionChange={mockCount === 0 ? setSelected : undefined}
          selectLabel={selectLabel}
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
      </div>
      <HoldingDrawer holding={drawerHolding} onClose={() => setDrawerId(null)} />
    </div>
  );
}

export default memo(HoldingsTable);
