import { useReducedMotion } from 'framer-motion';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  type PieLabelRenderProps,
} from 'recharts';
import { Segmented } from '@/components/FormControls';
import { IconChevronLeft } from '@/components/Icons';
import { useWidgetEvent } from '@/hooks/useWidgetEvent';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatInrCompact } from '@/utils/format';
import { buildLevel, drillInto, sliceColor, sliceIndexForSymbol, summarizePie } from './model';
import type {
  DrillStep,
  PieGrouping,
  PieSlice,
  PortfolioPieChartConfig,
  PortfolioPieChartData,
} from './types';

/** Transition length between grouping modes and drill levels (brief: 300–500 ms). */
export const PIE_ANIMATION_MS = 400;
/** Value labels are drawn only on slices at least this large, so they do not overlap. */
const LABEL_MIN_SHARE = 0.05;
const RADIAN = Math.PI / 180;
const INNER_RADIUS = 0.58;
/** Smallest donut hole (px) that fits the centre readout; below it the header shows it. */
const MIN_HOLE_PX = 84;
const TOP_LEVEL: DrillStep[] = [];

const GROUPING_OPTIONS: { value: PieGrouping; label: string }[] = [
  { value: 'asset-class', label: 'Class' },
  { value: 'sector', label: 'Sector' },
  { value: 'geography', label: 'Region' },
  { value: 'custom', label: 'Custom' },
];

interface ActiveShapeProps {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
}

/** The highlighted slice: drawn a little larger, so it stands out without relying on colour. */
function ActiveSlice(props: ActiveShapeProps) {
  return (
    <Sector
      cx={props.cx}
      cy={props.cy}
      innerRadius={props.innerRadius}
      outerRadius={(props.outerRadius ?? 0) + 5}
      startAngle={props.startAngle}
      endAngle={props.endAngle}
      fill={props.fill}
      stroke={cssColor('panel')}
      strokeWidth={1}
    />
  );
}

/** Percentage label just outside each large-enough slice. */
function ValueLabel(props: PieLabelRenderProps) {
  const percent = Number(props.percent ?? 0);
  if (percent < LABEL_MIN_SHARE) return null;
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const radius = Number(props.outerRadius ?? 0) + 9;
  const angle = Number(props.midAngle ?? 0);
  const x = cx + radius * Math.cos(-angle * RADIAN);
  const y = cy + radius * Math.sin(-angle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill={cssColor('text')}
      fontSize={10}
      textAnchor={x >= cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="num"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function PortfolioPieChart({
  instanceId,
  onConfigChange,
  data,
  config,
  width,
  height,
}: WidgetComponentProps<PortfolioPieChartConfig, PortfolioPieChartData>) {
  const reduceMotion = useReducedMotion() ?? false;
  // The drill path belongs to one grouping; switching grouping starts again at the top.
  const groupingKey = `${config.grouping}:${config.customField}`;
  const [drill, setDrill] = useState<{ grouping: string; path: DrillStep[] }>({
    grouping: groupingKey,
    path: [],
  });
  const path = drill.grouping === groupingKey ? drill.path : TOP_LEVEL;
  const level = useMemo(() => buildLevel(data, config, path), [data, config, path]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Hook point: SYMBOL_SELECTED from another widget highlights the slice holding that symbol.
  useWidgetEvent('SYMBOL_SELECTED', (event) => {
    if (event.sourceInstanceId !== instanceId) setSelectedSymbol(event.symbol);
  });
  const selected =
    selectedSymbol === null ? null : sliceIndexForSymbol(data, level, selectedSymbol);
  const active = hovered ?? selected;

  const goTo = useCallback(
    (next: DrillStep[]) => {
      setHovered(null);
      setDrill({ grouping: groupingKey, path: next });
    },
    [groupingKey],
  );
  const open = useCallback(
    (slice: PieSlice | undefined) => {
      if (!slice) return;
      const next = drillInto(level, slice);
      if (next) goTo(next);
    },
    [goTo, level],
  );
  const setGrouping = useCallback(
    (grouping: PieGrouping) => onConfigChange({ grouping }),
    [onConfigChange],
  );

  const donut = config.chartType === 'donut';
  const showLegend = width >= 260;
  const focus = active === null ? null : level.slices[active];
  const outer = config.showValueLabels ? 0.74 : 0.86;
  // Chart box: half the body beside the legend, less the header row and padding.
  const chartSide = Math.min(showLegend ? (width - 24) / 2 : width - 16, height - 44);
  const showCentre = donut && chartSide * outer * INNER_RADIUS >= MIN_HOLE_PX;
  const holdingsCount = level.slices.reduce((n, s) => n + s.count, 0);
  const colors = level.slices.map((s, i) => sliceColor(config.palette, i, s, level.slices.length));
  // Re-mounting the Pie when the grouping or level changes replays its entry animation.
  const pieKey = `${groupingKey}|${level.path.map((s) => s.key).join('/')}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        {level.path.length > 0 ? (
          <nav aria-label="Drill-down" className="flex min-w-0 items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => goTo(level.path.slice(0, -1))}
              className="flex items-center gap-0.5 rounded px-1 py-0.5 text-muted hover:bg-raised hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              <IconChevronLeft size={14} aria-hidden="true" />
              Back
            </button>
            <span className="truncate text-fg" title={level.path.map((s) => s.label).join(' › ')}>
              {level.path.map((s) => s.label).join(' › ')}
            </span>
          </nav>
        ) : (
          <span className="truncate text-2xs uppercase tracking-wide text-muted">
            {focus && !showCentre ? (
              <span className="normal-case tracking-normal text-fg">
                {focus.label} <span className="num">{focus.sharePct.toFixed(1)}%</span>
              </span>
            ) : (
              <>By {level.title.toLowerCase()}</>
            )}
          </span>
        )}
        <Segmented<PieGrouping>
          label="Group allocation by"
          value={config.grouping}
          options={GROUPING_OPTIONS}
          onValueChange={setGrouping}
        />
      </div>
      <p className="sr-only" role="status">
        {summarizePie(level)}
      </p>
      <div className="flex min-h-0 flex-1 items-center gap-2 px-2 pb-2">
        <div className={cx('relative h-full min-h-[96px]', showLegend ? 'w-1/2' : 'w-full')}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                key={pieKey}
                data={level.slices}
                dataKey="valueInr"
                nameKey="label"
                innerRadius={donut ? `${INNER_RADIUS * 100}%` : 0}
                outerRadius={`${outer * 100}%`}
                paddingAngle={donut ? 1 : 0}
                stroke={cssColor('panel')}
                strokeWidth={1}
                isAnimationActive={!reduceMotion}
                animationBegin={0}
                animationDuration={PIE_ANIMATION_MS}
                animationEasing="ease-out"
                activeIndex={active ?? undefined}
                activeShape={ActiveSlice}
                label={config.showValueLabels ? ValueLabel : false}
                labelLine={false}
                onMouseEnter={(_, index) => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onClick={(_, index) => open(level.slices[index])}
              >
                {level.slices.map((s, i) => (
                  <Cell
                    key={s.key}
                    fill={colors[i]}
                    fillOpacity={active === null || active === i ? 1 : 0.4}
                    cursor={s.drillable ? 'pointer' : 'default'}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {showCentre ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="max-w-[46%] truncate text-2xs text-muted">
                {focus ? focus.label : 'Total'}
              </span>
              <span className="num max-w-[50%] truncate text-xs font-semibold text-fg">
                {formatInrCompact(focus ? focus.valueInr : level.totalInr)}
              </span>
              <span className="num text-2xs text-muted">
                {focus
                  ? `${focus.sharePct.toFixed(1)}%`
                  : level.path.length > 0
                    ? `${level.bookPct.toFixed(1)}% of book`
                    : `${holdingsCount} holdings`}
              </span>
            </div>
          ) : null}
        </div>
        {showLegend ? (
          <ul
            aria-label={`${level.title} allocation`}
            className="scroll-thin h-full w-1/2 overflow-y-auto text-xs"
          >
            {level.slices.map((s, i) => {
              const content = (
                <>
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: colors[i] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-left text-fg">{s.label}</span>
                  <span className="num text-fg">{s.sharePct.toFixed(1)}%</span>
                </>
              );
              const highlight = {
                onMouseEnter: () => setHovered(i),
                onMouseLeave: () => setHovered(null),
              };
              const rowClass = cx(
                'flex w-full items-center gap-1.5 rounded px-1 py-0.5',
                active === i && 'bg-raised',
              );
              return (
                <li key={s.key}>
                  {s.drillable ? (
                    <button
                      type="button"
                      className={cx(
                        rowClass,
                        'hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus',
                      )}
                      aria-label={`${s.label}, ${s.sharePct.toFixed(1)}%, ${formatInrCompact(s.valueInr)}. Show breakdown`}
                      onClick={() => open(s)}
                      onFocus={() => setHovered(i)}
                      onBlur={() => setHovered(null)}
                      {...highlight}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className={rowClass} {...highlight}>
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export default memo(PortfolioPieChart);
