import { memo, useCallback, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceDot,
  ReferenceLine,
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
  chartPointBudget,
  xTickInterval,
  downsample,
  GRID_STROKE,
} from '@/components/charts';
import { Segmented } from '@/components/FormControls';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { formatPct } from '@/utils/format';
import { formatDateKey } from '@/utils/time';
import { buildDrawdown } from './model';
import {
  DRAWDOWN_RANGES,
  type DrawdownConfig,
  type DrawdownData,
  type DrawdownPoint,
  type DrawdownRange,
} from './types';

const NEG = cssColor('negative');
const BENCH = cssColor('textSubtle');

function DrawdownTooltip({
  active,
  label,
  byDate,
}: TooltipProps<number, string> & { byDate: Map<string, DrawdownPoint> }) {
  const key: unknown = label;
  if (!active || typeof key !== 'string') return null;
  const p = byDate.get(key);
  if (!p) return null;
  return (
    <ChartTooltipBody
      title={formatDateKey(key)}
      rows={[
        { key: 'f', label: 'Fund', value: formatPct(p.fund / 100, 2), color: NEG },
        { key: 'b', label: 'Nifty 50', value: formatPct(p.benchmark / 100, 2), color: BENCH },
      ]}
    />
  );
}

function Drawdown({
  onConfigChange,
  data,
  config,
  width,
}: WidgetComponentProps<DrawdownConfig, DrawdownData>) {
  const model = useMemo(() => buildDrawdown(data, config), [data, config]);
  const points = useMemo(() => {
    const sampled = downsample(model.points, chartPointBudget(width));
    // Always keep the trough so the marker sits on the line.
    const trough = model.points.find((p) => p.date === model.troughDate);
    if (trough && !sampled.some((p) => p.date === trough.date)) {
      sampled.push(trough);
      sampled.sort((a, b) => a.date.localeCompare(b.date));
    }
    return sampled;
  }, [model, width]);
  const byDate = useMemo(() => new Map(points.map((p) => [p.date, p])), [points]);
  const setRange = useCallback(
    (range: DrawdownRange) => onConfigChange({ range }),
    [onConfigChange],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 text-xs">
        <dl className="flex gap-4">
          <div className="flex gap-1.5">
            <dt className="text-muted">Max</dt>
            <dd className="num text-neg">▼ {formatPct(model.maxDepth, 1, false)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">Current</dt>
            <dd className="num text-fg">{formatPct(-model.current, 1)}</dd>
          </div>
          {model.troughDate ? (
            <div className="hidden gap-1.5 sm:flex">
              <dt className="text-muted">Trough</dt>
              <dd className="num text-fg">{formatDateKey(model.troughDate)}</dd>
            </div>
          ) : null}
        </dl>
        <Segmented<DrawdownRange>
          label="Drawdown range"
          value={config.range}
          options={DRAWDOWN_RANGES.map((r) => ({ value: r, label: r }))}
          onValueChange={setRange}
        />
      </div>
      <div className="min-h-0 flex-1 px-1 pb-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="date"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: GRID_STROKE }}
              interval={xTickInterval(points.length, width)}
              tickFormatter={(d: string) => formatDateKey(d)}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[(min: number) => Math.min(min, -config.thresholdPct) * 1.08, 0]}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <ReferenceLine
              y={-config.thresholdPct}
              stroke={cssColor('warning')}
              strokeDasharray="4 3"
              label={{
                value: `Review −${config.thresholdPct}%`,
                position: 'insideBottomRight',
                fill: cssColor('warning'),
                fontSize: 10,
              }}
            />
            <Tooltip
              cursor={CURSOR_STYLE}
              isAnimationActive={false}
              content={<DrawdownTooltip byDate={byDate} />}
            />
            <Area
              type="linear"
              dataKey="fund"
              stroke={NEG}
              strokeWidth={1.25}
              fill={NEG}
              fillOpacity={0.18}
              isAnimationActive={false}
            />
            {config.showBenchmark ? (
              <Line
                type="linear"
                dataKey="benchmark"
                stroke={BENCH}
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
            {model.troughDate ? (
              <ReferenceDot
                x={model.troughDate}
                y={-model.maxDepth * 100}
                r={3}
                fill={NEG}
                stroke="rgb(var(--color-panel))"
                label={{
                  value: `Max ${formatPct(-model.maxDepth, 1)}`,
                  position: 'bottom',
                  fill: cssColor('text'),
                  fontSize: 10,
                }}
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(Drawdown);
