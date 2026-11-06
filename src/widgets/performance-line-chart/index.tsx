import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import {
  AXIS_TICK,
  ChartTooltipBody,
  CURSOR_STYLE,
  GRID_STROKE,
  xTickInterval,
} from '@/components/charts';
import { Segmented } from '@/components/FormControls';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatPct } from '@/utils/format';
import { formatDateKey } from '@/utils/time';
import { eventBus } from '@/registry/eventBus';
import {
  clampWindow,
  describeWindow,
  panWindow,
  presetWindow,
  rebasedRows,
  scaleWindow,
  selectedSeries,
  seriesStyle,
  zoomTo,
} from './model';
import {
  PERF_PRESETS,
  type ChartRow,
  type ChartSeries,
  type DateWindow,
  type PerfPreset,
  type PerformanceLineChartConfig,
  type PerformanceLineChartData,
} from './types';

/** DATE_RANGE_CHANGED waits for the range to settle (brush and scroll fire continuously). */
export const DATE_RANGE_DEBOUNCE_MS = 250;
const Y_AXIS_WIDTH = 40;
const MARGIN = { top: 6, right: 10, bottom: 0, left: 0 };

type Styles = ReturnType<typeof seriesStyle>;

interface ChartPointerState {
  activeLabel?: string | number;
  chartY?: number;
}

function CrosshairTooltip({
  active,
  label,
  byDate,
  series,
  styles,
}: TooltipProps<number, string> & {
  byDate: Map<string, ChartRow>;
  series: readonly ChartSeries[];
  styles: Styles;
}) {
  const key: unknown = label;
  if (!active || typeof key !== 'string') return null;
  const row = byDate.get(key);
  if (!row) return null;
  const values = series
    .flatMap((s) => {
      const v = row[s.key];
      return v === undefined ? [] : [{ s, v }];
    })
    .sort((a, b) => b.v - a.v);
  return (
    <ChartTooltipBody
      title={formatDateKey(key)}
      rows={values.map(({ s, v }) => ({
        key: s.key,
        label: s.short,
        value: `${v.toFixed(1)}  ${formatPct(v / 100 - 1, 1)}`,
        color: styles[s.key]?.stroke,
      }))}
    />
  );
}

function PerformanceLineChart({
  onConfigChange,
  data,
  config,
  width,
}: WidgetComponentProps<PerformanceLineChartConfig, PerformanceLineChartData>) {
  const { dates } = data;
  const count = dates.length;
  const series = useMemo(() => selectedSeries(data, config), [data, config]);
  const styles = useMemo(() => seriesStyle(config, series), [config, series]);
  const preset = useMemo(() => presetWindow(dates, config.range), [dates, config.range]);

  // Zoom / pan / brush state belongs to one preset; picking a preset starts from it again.
  const [custom, setCustom] = useState<{ range: PerfPreset; win: DateWindow } | null>(null);
  const win = useMemo(
    () => (custom && custom.range === config.range ? clampWindow(custom.win, count) : preset),
    [custom, config.range, count, preset],
  );
  const zoomed = win.start !== preset.start || win.end !== preset.end;
  const setWindow = useCallback(
    (next: DateWindow) => setCustom({ range: config.range, win: clampWindow(next, count) }),
    [config.range, count],
  );
  const winRef = useRef(win);
  winRef.current = win;

  const rows: ChartRow[] = useMemo(
    () => rebasedRows(dates, series, win.start),
    [dates, series, win.start],
  );
  const dateIndex = useMemo(() => new Map(dates.map((d, i) => [d, i])), [dates]);
  const byDate = useMemo(() => new Map(rows.map((r) => [r.date, r])), [rows]);

  // Drag to zoom (ReferenceArea while dragging) and a horizontal crosshair line.
  const [drag, setDrag] = useState<{ from: string; to: string } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const [pointerY, setPointerY] = useState<number | null>(null);
  const onMouseDown = useCallback((s: ChartPointerState | null) => {
    if (typeof s?.activeLabel === 'string') setDrag({ from: s.activeLabel, to: s.activeLabel });
  }, []);
  const onMouseMove = useCallback((s: ChartPointerState | null) => {
    setPointerY(typeof s?.chartY === 'number' ? s.chartY : null);
    const label = s?.activeLabel;
    if (typeof label === 'string') setDrag((d) => (d ? { ...d, to: label } : d));
  }, []);
  const onMouseUp = useCallback(() => {
    const d = dragRef.current;
    setDrag(null);
    if (!d) return;
    const a = dateIndex.get(d.from);
    const b = dateIndex.get(d.to);
    if (a !== undefined && b !== undefined && Math.abs(a - b) >= 1) {
      setWindow(zoomTo(a, b, count));
    }
  }, [count, dateIndex, setWindow]);
  const onMouseLeave = useCallback(() => {
    setPointerY(null);
    setDrag(null);
  }, []);

  // Scroll to pan. A native listener, because React's wheel listener is passive and the page
  // must not scroll while panning the chart.
  const plotRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      setWindow(panWindow(winRef.current, Math.sign(delta), count));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [count, setWindow]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const actions: Record<string, () => DateWindow> = {
        ArrowLeft: () => panWindow(win, -1, count),
        ArrowRight: () => panWindow(win, 1, count),
        '+': () => scaleWindow(win, 0.5, count),
        '=': () => scaleWindow(win, 0.5, count),
        '-': () => scaleWindow(win, 2, count),
        Home: () => preset,
      };
      const action = actions[e.key];
      if (!action) return;
      e.preventDefault();
      setWindow(action());
    },
    [count, preset, setWindow, win],
  );

  const onBrush = useCallback(
    (range: { startIndex?: number; endIndex?: number }) => {
      if (range.startIndex === undefined || range.endIndex === undefined) return;
      if (range.startIndex === winRef.current.start && range.endIndex === winRef.current.end) {
        return;
      }
      setWindow({ start: range.startIndex, end: range.endIndex });
    },
    [setWindow],
  );

  // Hook point: tell other widgets the visible range changed (not on first render).
  const from = dates[win.start] ?? '';
  const to = dates[win.end] ?? '';
  const published = useRef(`${from}|${to}`);
  useEffect(() => {
    const key = `${from}|${to}`;
    if (key === published.current || !from || !to) return undefined;
    const timer = setTimeout(() => {
      published.current = key;
      eventBus.publish('DATE_RANGE_CHANGED', { from, to });
    }, DATE_RANGE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [from, to]);

  const setPreset = useCallback(
    (range: PerfPreset) => {
      setCustom(null);
      onConfigChange({ range });
    },
    [onConfigChange],
  );
  const toggleLog = useCallback(
    () => onConfigChange({ logScale: !config.logScale }),
    [onConfigChange, config.logScale],
  );

  const visible = win.end - win.start + 1;
  const dragArea =
    drag && drag.from !== drag.to
      ? drag.from < drag.to
        ? { x1: drag.from, x2: drag.to }
        : { x1: drag.to, x2: drag.from }
      : null;
  const buttonClass =
    'rounded border border-line px-1.5 py-0.5 text-2xs text-muted hover:bg-raised hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus';

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pt-2">
        <Segmented<PerfPreset>
          label="Date range"
          value={config.range}
          options={PERF_PRESETS.map((p) => ({ value: p, label: p }))}
          onValueChange={setPreset}
        />
        <button
          type="button"
          aria-pressed={config.logScale}
          onClick={toggleLog}
          className={cx(buttonClass, config.logScale && 'border-accent text-fg')}
          title="Logarithmic y-axis: equal heights show equal percentage moves"
        >
          Log
        </button>
        {zoomed ? (
          <button type="button" onClick={() => setCustom(null)} className={buttonClass}>
            Reset zoom
          </button>
        ) : null}
        <ul aria-label="Series" className="ml-auto flex flex-wrap items-center gap-x-2 text-2xs">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1 text-muted" title={s.name}>
              <svg aria-hidden="true" width="12" height="4">
                <line
                  x1="0"
                  y1="2"
                  x2="12"
                  y2="2"
                  stroke={styles[s.key]?.stroke}
                  strokeWidth={s.key === 'FUND' ? 2 : 1.5}
                  strokeDasharray={styles[s.key]?.dash}
                />
              </svg>
              {s.short}
            </li>
          ))}
        </ul>
      </div>
      <p className="sr-only" role="status">
        {describeWindow(dates, series, win)}
      </p>
      <div
        ref={plotRef}
        role="group"
        tabIndex={0}
        aria-label="Performance chart. Drag to zoom, scroll or arrow keys to pan, plus and minus to zoom, Home to reset."
        onKeyDown={onKeyDown}
        className="relative min-h-0 flex-1 select-none px-1 pb-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={MARGIN}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
          >
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="date"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: GRID_STROKE }}
              interval={xTickInterval(visible, width)}
              tickFormatter={(d: string) => formatDateKey(d, visible > 260)}
              minTickGap={8}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={Y_AXIS_WIDTH}
              scale={config.logScale ? 'log' : 'linear'}
              domain={['auto', 'auto']}
              allowDataOverflow
              tickFormatter={(v: number) => v.toFixed(0)}
            />
            <Tooltip
              cursor={CURSOR_STYLE}
              isAnimationActive={false}
              content={<CrosshairTooltip byDate={byDate} series={series} styles={styles} />}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="linear"
                dataKey={s.key}
                name={s.short}
                stroke={styles[s.key]?.stroke}
                strokeWidth={styles[s.key]?.width}
                strokeDasharray={styles[s.key]?.dash}
                dot={false}
                activeDot={{ r: 2.5 }}
                isAnimationActive={false}
              />
            ))}
            {dragArea ? (
              <ReferenceArea
                x1={dragArea.x1}
                x2={dragArea.x2}
                fill={cssColor('accent', 0.12)}
                stroke={cssColor('accent', 0.5)}
              />
            ) : null}
            <Brush
              dataKey="date"
              height={16}
              travellerWidth={6}
              startIndex={win.start}
              endIndex={win.end}
              onChange={onBrush}
              stroke={cssColor('borderStrong')}
              fill={cssColor('panel')}
              tickFormatter={(d: string) => formatDateKey(d)}
            />
          </LineChart>
        </ResponsiveContainer>
        {pointerY !== null && !drag ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[14px] border-t border-dashed border-line-strong"
            style={{ top: pointerY, left: Y_AXIS_WIDTH + 4 }}
          />
        ) : null}
      </div>
    </div>
  );
}

export default memo(PerformanceLineChart);
