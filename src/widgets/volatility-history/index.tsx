import { memo, useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import {
  AXIS_TICK,
  ChartTooltipBody,
  chartPointBudget,
  CURSOR_STYLE,
  downsample,
  GRID_STROKE,
  xTickInterval,
} from '@/components/charts';
import { Segmented } from '@/components/FormControls';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { formatDateKey } from '@/utils/time';
import { rollingVolatility, volSummary } from './model';
import {
  VOL_RANGES,
  VOL_WINDOWS,
  type VolatilityHistoryConfig,
  type VolatilityHistoryData,
  type VolPoint,
  type VolRange,
} from './types';

const FUND = cssColor('accent');
const BENCH = cssColor('textMuted');

function VolTooltip({
  active,
  label,
  byDate,
}: TooltipProps<number, string> & { byDate: Map<string, VolPoint> }) {
  const key: unknown = label;
  if (!active || typeof key !== 'string') return null;
  const p = byDate.get(key);
  if (!p) return null;
  return (
    <ChartTooltipBody
      title={formatDateKey(key)}
      rows={[
        { key: 'f', label: 'Fund', value: `${p.fund.toFixed(1)}%`, color: FUND },
        { key: 'b', label: 'Nifty 50', value: `${p.benchmark.toFixed(1)}%`, color: BENCH },
      ]}
    />
  );
}

function VolatilityHistory({
  onConfigChange,
  data,
  config,
  width,
}: WidgetComponentProps<VolatilityHistoryConfig, VolatilityHistoryData>) {
  const all = useMemo(() => rollingVolatility(data, config), [data, config]);
  const points = useMemo(() => downsample(all, chartPointBudget(width)), [all, width]);
  const byDate = useMemo(() => new Map(points.map((p) => [p.date, p])), [points]);
  const last = all[all.length - 1];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 text-xs">
        <dl className="flex gap-3">
          <div className="flex gap-1">
            <dt className="text-muted">Fund</dt>
            <dd className="num text-fg">{last ? `${last.fund.toFixed(1)}%` : '—'}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted">Nifty 50</dt>
            <dd className="num text-fg">{last ? `${last.benchmark.toFixed(1)}%` : '—'}</dd>
          </div>
        </dl>
        <div className="flex gap-1">
          <Segmented<VolatilityHistoryConfig['window']>
            label="Rolling window (trading days)"
            value={config.window}
            options={VOL_WINDOWS.map((w) => ({ value: w, label: `${w}d` }))}
            onValueChange={(window) => onConfigChange({ window })}
          />
          <Segmented<VolRange>
            label="Range"
            value={config.range}
            options={VOL_RANGES.map((r) => ({ value: r, label: r }))}
            onValueChange={(range) => onConfigChange({ range })}
          />
        </div>
      </div>
      <p className="sr-only" role="status">
        {volSummary(all, config)}
      </p>
      <div className="min-h-0 flex-1 px-1 pb-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
              width={36}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <Tooltip
              cursor={CURSOR_STYLE}
              isAnimationActive={false}
              content={<VolTooltip byDate={byDate} />}
            />
            <Line
              type="linear"
              dataKey="fund"
              stroke={FUND}
              strokeWidth={1.5}
              dot={false}
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
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(VolatilityHistory);
