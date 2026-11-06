import { memo, useCallback, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { AXIS_TICK, ChartTooltipBody, GRID_STROKE } from '@/components/charts';
import { Segmented } from '@/components/FormControls';
import { IconChevronLeft, IconClose } from '@/components/Icons';
import { Select } from '@/components/Select';
import { useWidgetEvent } from '@/hooks/useWidgetEvent';
import { cssColor } from '@/theme/themes';
import type { ThemeTokenKey, WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatDateKey } from '@/utils/time';
import {
  attributeWindow,
  formatUnit,
  holdingContributions,
  inUnit,
  periodWindows,
  RELATIVE_MIN_ACTIVE,
  summarizeWindow,
} from './model';
import type {
  AttributionBarChartConfig,
  AttributionBarChartData,
  Grouping,
  PeriodKey,
  WindowAttribution,
} from './types';

const EFFECTS = [
  { key: 'allocation', label: 'Allocation', token: 'chart1' },
  { key: 'selection', label: 'Selection', token: 'chart2' },
  { key: 'interaction', label: 'Interaction', token: 'chart3' },
] as const satisfies readonly { key: string; label: string; token: ThemeTokenKey }[];
/** Periods side by side: same effect colours, fading left to right. */
const PERIOD_OPACITY = [1, 0.62, 0.36, 0.2];
const PERIOD_TOKENS: ThemeTokenKey[] = ['chart1', 'chart4', 'chart5', 'chart6'];
const SHORT_PERIOD: Record<PeriodKey, string> = {
  mtd: 'This month',
  prev: 'Last month',
  yoy: 'Same month LY',
  range: 'Selected range',
};

/** Axis labels for long segment names (the tooltip shows the full name). */
const SHORT_LABEL: Record<string, string> = {
  'Financial Services': 'Financials',
  'Information Technology': 'IT',
  'Oil, Gas & Fuels': 'Energy',
  'Construction Materials': 'Cement',
  'Consumer Services': 'Cons. Svcs',
  'Consumer Durables': 'Durables',
  'Metals & Mining': 'Metals',
  'Capital Goods': 'Cap. Goods',
  Telecommunication: 'Telecom',
  Healthcare: 'Health',
  Automobile: 'Auto',
  'Fixed Income': 'Fixed Inc.',
  Alternatives: 'Alts',
  'High beta (β ≥ 1.1)': 'High β',
  'Low beta (β < 0.9)': 'Low β',
  'Market beta': 'Market β',
};

type Row = { key: string; label: string } & Record<string, number | string>;

function AttributionTooltip({
  active,
  payload,
  label,
  unit,
}: TooltipProps<number, string> & { unit: 'bps' | 'pct' }) {
  if (!active || !payload?.length || typeof label !== 'string') return null;
  return (
    <ChartTooltipBody
      title={label}
      rows={payload.map((p, i) => ({
        key: `${String(p.dataKey)}-${i}`,
        label: String(p.name ?? p.dataKey),
        value: formatUnit(typeof p.value === 'number' ? p.value : 0, unit),
        color: typeof p.color === 'string' ? p.color : undefined,
      }))}
    />
  );
}

function AttributionBarChart({
  onConfigChange,
  data,
  config,
}: WidgetComponentProps<AttributionBarChartConfig, AttributionBarChartData>) {
  // DATE_RANGE_CHANGED (e.g. from the performance line chart) adds a "Selected range" period.
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [choice, setChoice] = useState<PeriodKey | null>(null);
  useWidgetEvent('DATE_RANGE_CHANGED', (e) => {
    setRange({ from: e.from, to: e.to });
    setChoice('range');
  });

  const windows = useMemo(() => periodWindows(data.dates, range), [data.dates, range]);
  const results = useMemo(
    () => windows.map((w) => attributeWindow(data, config.grouping, w)),
    [windows, data, config.grouping],
  );
  const selectedKey: PeriodKey =
    choice && windows.some((w) => w.key === choice) ? choice : config.period;
  const selected = results.find((r) => r.window.key === selectedKey) ?? results[0];

  // Drill path: asset class → (Equity) sector → holding, or segment → holding elsewhere.
  const [path, setPath] = useState<{ grouping: Grouping; keys: string[] }>({
    grouping: config.grouping,
    keys: [],
  });
  const keys = useMemo(
    () => (path.grouping === config.grouping ? path.keys : []),
    [path, config.grouping],
  );
  const equityDrill = config.grouping === 'asset-class' && keys[0] === 'Equity';
  const sectorResults = useMemo(
    () => (equityDrill ? windows.map((w) => attributeWindow(data, 'sector', w)) : null),
    [equityDrill, windows, data],
  );
  const levelGrouping: Grouping = equityDrill ? 'sector' : config.grouping;
  const levelResults = sectorResults ?? results;
  const segmentKey: string | null = equityDrill ? (keys[1] ?? null) : (keys[0] ?? null);
  const levelSelected = levelResults.find((r) => r.window.key === selectedKey) ?? levelResults[0];
  const levelShown: WindowAttribution[] = useMemo(
    () => (config.compare ? levelResults : levelSelected ? [levelSelected] : []),
    [config.compare, levelResults, levelSelected],
  );
  const relativeOk = levelShown.every((r) => Math.abs(r.active) >= RELATIVE_MIN_ACTIVE);
  const unit = config.unit === 'pct' && relativeOk ? 'pct' : 'bps';

  const rows: Row[] = useMemo(() => {
    const base = levelSelected;
    if (!base) return [];
    if (segmentKey) {
      const per = levelShown.map((r) => ({
        r,
        items: holdingContributions(data, levelGrouping, r, segmentKey),
      }));
      const first = per[0]?.items ?? [];
      return first.map((h) => {
        const row: Row = { key: h.key, label: h.label };
        for (const { r, items } of per) {
          const v = items.find((x) => x.key === h.key)?.contribution ?? 0;
          row[`${r.window.key}_contribution`] = inUnit(v, unit, r.active);
        }
        return row;
      });
    }
    return base.segments.map((seg) => {
      const row: Row = { key: seg.key, label: seg.label };
      for (const r of levelShown) {
        const s = r.segments.find((x) => x.key === seg.key);
        for (const e of EFFECTS)
          row[`${r.window.key}_${e.key}`] = inUnit(s?.[e.key] ?? 0, unit, r.active);
        row[`${r.window.key}_total`] = inUnit(s?.total ?? 0, unit, r.active);
      }
      return row;
    });
  }, [levelSelected, levelShown, segmentKey, data, levelGrouping, unit]);

  const open = useCallback(
    (key: string) => setPath({ grouping: config.grouping, keys: [...keys, key] }),
    [config.grouping, keys],
  );
  const back = () => setPath({ grouping: config.grouping, keys: keys.slice(0, -1) });
  const onBarClick = useCallback(
    (_: unknown, index: number) => {
      const row = rows[index];
      if (!segmentKey && row) open(row.key);
    },
    [rows, segmentKey, open],
  );

  const bars = (() => {
    if (segmentKey) {
      return levelShown.map((r, i) => (
        <Bar
          key={r.window.key}
          dataKey={`${r.window.key}_contribution`}
          name={`${SHORT_PERIOD[r.window.key]}: contribution`}
          fill={cssColor(config.compare ? (PERIOD_TOKENS[i] ?? 'chart1') : 'chart2')}
          isAnimationActive={false}
        />
      ));
    }
    if (config.compare && config.layout === 'grouped') {
      return levelShown.map((r, i) => (
        <Bar
          key={r.window.key}
          dataKey={`${r.window.key}_total`}
          name={`${SHORT_PERIOD[r.window.key]}: total`}
          fill={cssColor(PERIOD_TOKENS[i] ?? 'chart1')}
          onClick={onBarClick}
          cursor="pointer"
          isAnimationActive={false}
        />
      ));
    }
    return levelShown.flatMap((r, i) =>
      EFFECTS.map((e) => (
        <Bar
          key={`${r.window.key}_${e.key}`}
          dataKey={`${r.window.key}_${e.key}`}
          name={config.compare ? `${SHORT_PERIOD[r.window.key]}: ${e.label}` : e.label}
          stackId={config.layout === 'stacked' ? r.window.key : undefined}
          fill={cssColor(e.token)}
          fillOpacity={config.compare ? PERIOD_OPACITY[i] : 1}
          onClick={onBarClick}
          cursor="pointer"
          isAnimationActive={false}
        />
      )),
    );
  })();

  const drillLabel =
    keys.length === 0
      ? null
      : `${keys.join(' › ')}: ${segmentKey ? 'holding contributions' : 'sectors (equity vs Nifty 50)'}`;
  const periodOptions = windows.map((w) => ({ value: w.key, label: w.label }));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1 px-2 pt-1.5">
        {drillLabel ? (
          <nav aria-label="Attribution level" className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={back}
              className="flex items-center gap-0.5 rounded px-1 py-0.5 text-muted hover:bg-raised hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              <IconChevronLeft size={14} aria-hidden="true" />
              Back
            </button>
            <span className="text-fg">{drillLabel}</span>
          </nav>
        ) : (
          <Segmented<Grouping>
            label="Attribute by"
            value={config.grouping}
            options={[
              { value: 'sector', label: 'Sector' },
              { value: 'factor', label: 'Factor' },
              { value: 'asset-class', label: 'Class' },
            ]}
            onValueChange={(grouping) => onConfigChange({ grouping })}
          />
        )}
        <Segmented<'stacked' | 'grouped'>
          label="Bar layout"
          value={config.layout}
          options={[
            { value: 'stacked', label: 'Stacked' },
            { value: 'grouped', label: 'Grouped' },
          ]}
          onValueChange={(layout) => onConfigChange({ layout })}
        />
        <Segmented<'bps' | 'pct'>
          label="Units"
          value={config.unit}
          options={[
            { value: 'bps', label: 'bps' },
            { value: 'pct', label: '%' },
          ]}
          onValueChange={(u) => onConfigChange({ unit: u })}
        />
        <button
          type="button"
          aria-label="Compare periods"
          title="This month, last month and the same month last year side by side"
          aria-pressed={config.compare}
          onClick={() => onConfigChange({ compare: !config.compare })}
          className={cx(
            'h-6 rounded border px-2 text-2xs hover:bg-raised',
            config.compare ? 'border-accent text-fg' : 'border-line text-muted',
          )}
        >
          Compare
        </button>
        {!config.compare ? (
          <Select<PeriodKey>
            label="Period"
            hideLabel
            value={selectedKey}
            options={periodOptions}
            onValueChange={(key) => {
              setChoice(key);
              if (key !== 'range') onConfigChange({ period: key });
            }}
          />
        ) : null}
        {!segmentKey && levelSelected ? (
          <Select<string>
            label="Drill into"
            value=""
            options={[
              { value: '', label: 'Choose…' },
              ...levelSelected.segments.map((s) => ({ value: s.key, label: s.label })),
            ]}
            onValueChange={(key) => {
              if (key) open(key);
            }}
          />
        ) : null}
        {range ? (
          <span className="inline-flex items-center gap-1 rounded border border-line-strong px-1.5 text-2xs text-muted">
            Range {formatDateKey(range.from, false)}–{formatDateKey(range.to, false)}
            <button
              type="button"
              aria-label="Remove the selected range"
              onClick={() => {
                setRange(null);
                setChoice(null);
              }}
              className="hover:text-fg"
            >
              <IconClose size={10} aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 px-2 pt-0.5">
        <p className="text-2xs text-muted" title={selected?.window.label}>
          {config.compare
            ? `Left to right: ${levelShown.map((r) => SHORT_PERIOD[r.window.key]).join(', ')}`
            : segmentKey
              ? 'Weight × (return − segment benchmark return)'
              : ''}
          {config.unit === 'pct' && unit === 'bps' ? ' · active under 5 bps: in bps' : ''}
        </p>
        <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-2 text-2xs text-muted">
          {segmentKey
            ? null
            : config.compare && config.layout === 'grouped'
              ? levelShown.map((r, i) => (
                  <li key={r.window.key} className="flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ background: cssColor(PERIOD_TOKENS[i] ?? 'chart1') }}
                    />
                    {SHORT_PERIOD[r.window.key]} (total)
                  </li>
                ))
              : EFFECTS.map((e) => (
                  <li key={e.key} className="flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ background: cssColor(e.token) }}
                    />
                    {e.label}
                  </li>
                ))}
        </ul>
      </div>
      <p className="sr-only" role="status">
        {selected ? summarizeWindow(selected, config.grouping) : ''}
      </p>
      <div className="min-h-0 flex-1 px-1 pb-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              minTickGap={4}
              tickFormatter={(v: string) =>
                SHORT_LABEL[v] ?? (v.length > 9 ? `${v.slice(0, 8)}…` : v)
              }
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => formatUnit(v, unit).replace(' bps', '')}
            />
            <ReferenceLine y={0} stroke={cssColor('borderStrong')} />
            <Tooltip
              isAnimationActive={false}
              cursor={{ fill: cssColor('raised', 0.6) }}
              content={<AttributionTooltip unit={unit} />}
            />
            {bars}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(AttributionBarChart);
