import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Segmented } from '@/components/FormControls';
import type { WidgetComponentProps } from '@/types';
import { correlationColor, correlationTextColor } from './colors';
import {
  buildMatrix,
  cellLabel,
  formatCorrelation,
  formatCorrelationShort,
  selectSeries,
  summarizeMatrix,
} from './model';
import { ScatterModal } from './ScatterModal';
import {
  LOOKBACKS,
  type CellPair,
  type CorrelationMatrixConfig,
  type CorrelationMatrixData,
  type Lookback,
} from './types';

const TOOLBAR_PX = 30;
const LEGEND_PX = 18;
/** Cell sizes for the printed number: "0.62" from 26 px, ".62" from 15 px, none below. */
const FULL_NUMBER_PX = 26;
const SHORT_NUMBER_PX = 15;

function CorrelationMatrix({
  onConfigChange,
  data,
  config,
  width,
  height,
}: WidgetComponentProps<CorrelationMatrixConfig, CorrelationMatrixData>) {
  const { dates, series } = useMemo(() => selectSeries(data, config), [data, config]);
  // The O(n² × days) computation runs only when the series or lookback change.
  const matrix = useMemo(() => buildMatrix(series), [series]);
  const n = series.length;
  // Cells fill the widget; they may be wider than tall (up to 3:1) to fit numbers and names.
  const cellH = Math.max(10, Math.floor((height - TOOLBAR_PX - LEGEND_PX - 8) / Math.max(1, n)));
  const cellW = Math.max(10, Math.min(cellH * 3, Math.floor((width - 16) / Math.max(1, n))));
  const numberText = (r: number) =>
    cellW >= FULL_NUMBER_PX && cellH >= 12
      ? formatCorrelation(r)
      : cellW >= SHORT_NUMBER_PX && cellH >= 10
        ? formatCorrelationShort(r)
        : null;

  const [active, setActive] = useState<CellPair>({ row: 0, col: 1 });
  const [open, setOpen] = useState<CellPair | null>(null);
  const cells = useRef(new Map<string, HTMLDivElement>());
  const focusCell = useCallback((row: number, col: number) => {
    setActive({ row, col });
    cells.current.get(`${row}:${col}`)?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, row: number, col: number) => {
    const last = n - 1;
    const moves: Record<string, [number, number]> = {
      ArrowRight: [row, Math.min(last, col + 1)],
      ArrowLeft: [row, Math.max(0, col - 1)],
      ArrowDown: [Math.min(last, row + 1), col],
      ArrowUp: [Math.max(0, row - 1), col],
      Home: [row, 0],
      End: [row, last],
    };
    const to = moves[e.key];
    if (to) {
      e.preventDefault();
      focusCell(to[0], to[1]);
    } else if ((e.key === 'Enter' || e.key === ' ') && row !== col) {
      e.preventDefault();
      setOpen({ row, col });
    }
  };

  const a = open ? series[open.row] : undefined;
  const b = open ? series[open.col] : undefined;
  const activeRow = Math.min(active.row, n - 1);
  const activeCol = Math.min(active.col, n - 1);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-1 px-2 pt-1.5">
        <Segmented<CorrelationMatrixConfig['subject']>
          label="Compare"
          value={config.subject}
          options={[
            { value: 'holdings', label: 'Holdings' },
            { value: 'sectors', label: 'Sectors' },
          ]}
          onValueChange={(subject) => onConfigChange({ subject })}
        />
        <Segmented<Lookback>
          label="Lookback (trading days)"
          value={config.lookback}
          options={LOOKBACKS.map((d) => ({ value: d, label: `${d}d` }))}
          onValueChange={(lookback) => onConfigChange({ lookback })}
        />
      </div>
      <p className="sr-only" role="status">
        {summarizeMatrix(series, matrix, dates.length)}
      </p>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-1">
        <div
          role="grid"
          aria-label={`Correlation of daily returns over ${dates.length} days. Arrow keys move; Enter opens a scatter plot.`}
          aria-rowcount={n}
          aria-colcount={n}
          className="grid"
          style={{ gridTemplateColumns: `repeat(${n}, ${cellW}px)`, gridAutoRows: `${cellH}px` }}
        >
          {series.map((rowSeries, row) => (
            <div role="row" key={rowSeries.key} className="contents">
              {series.map((colSeries, col) => {
                const r = matrix[row]?.[col] ?? 0;
                const diagonal = row === col;
                const label = diagonal
                  ? `${rowSeries.label} (${rowSeries.name})`
                  : cellLabel(rowSeries, colSeries, r);
                return (
                  <div
                    key={colSeries.key}
                    role="gridcell"
                    ref={(el) => {
                      if (el) cells.current.set(`${row}:${col}`, el);
                      else cells.current.delete(`${row}:${col}`);
                    }}
                    tabIndex={row === activeRow && col === activeCol ? 0 : -1}
                    aria-label={label}
                    title={label}
                    onClick={() => {
                      setActive({ row, col });
                      if (!diagonal) setOpen({ row, col });
                    }}
                    onKeyDown={(e) => onKeyDown(e, row, col)}
                    onFocus={() => setActive({ row, col })}
                    className={
                      diagonal
                        ? 'flex items-center justify-center overflow-hidden border border-line bg-raised text-[9px] font-semibold text-fg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus'
                        : 'num flex cursor-pointer items-center justify-center border border-panel text-[9px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus'
                    }
                    style={
                      diagonal
                        ? undefined
                        : { background: correlationColor(r), color: correlationTextColor(r) }
                    }
                  >
                    {diagonal ? (
                      <span className="truncate px-0.5" aria-hidden="true">
                        {rowSeries.label}
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className={cellW < FULL_NUMBER_PX || cellH < 14 ? 'text-[8px]' : undefined}
                      >
                        {numberText(r)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div
        className="flex items-center justify-center gap-1.5 pb-1 text-2xs text-muted"
        aria-hidden="true"
      >
        <span className="num">−1</span>
        <span
          className="inline-block h-2 w-24 rounded-sm"
          style={{
            background: `linear-gradient(to right, ${correlationColor(-1)}, ${correlationColor(0)}, ${correlationColor(1)})`,
          }}
        />
        <span className="num">+1</span>
        <span>· {dates.length} days</span>
      </div>
      {a && b ? <ScatterModal a={a} b={b} dates={dates} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

export default memo(CorrelationMatrix);
