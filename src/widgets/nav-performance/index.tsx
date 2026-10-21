import { memo, useCallback, useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
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
import { Delta } from '@/components/Delta';
import { Segmented } from '@/components/FormControls';
import { useWidgetStore } from '@/store/widgetStore';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { formatPct } from '@/utils/format';
import { formatDateKey } from '@/utils/time';
import { buildNavSeries } from './model';
import {
  NAV_RANGES,
  type NavChartPoint,
  type NavPerformanceConfig,
  type NavPerformanceData,
  type NavRange,
} from './types';

const PORTFOLIO = cssColor('chart1');
const BENCHMARK = cssColor('textSubtle');

function NavTooltip({
  active,
  label,
  byDate,
  rebased,
}: TooltipProps<number, string> & { byDate: Map<string, NavChartPoint>; rebased: boolean }) {
  const key: unknown = label;
  if (!active || typeof key !== 'string') return null;
  const p = byDate.get(key);
  if (!p) return null;
  const fmt = (v: number) => (rebased ? v.toFixed(2) : `₹${v.toFixed(2)}`);
  return (
    <ChartTooltipBody
      title={formatDateKey(key)}
      rows={[
        { key: 'p', label: 'Fund', value: fmt(p.portfolio), color: PORTFOLIO },
        { key: 'b', label: 'Nifty 50', value: fmt(p.benchmark), color: BENCHMARK },
        {
          key: 'a',
          label: 'Spread',
          value: <Delta value={(p.portfolio - p.benchmark) / p.benchmark} arrow={false} />,
        },
      ]}
    />
  );
}

function NavPerformance({
  instanceId,
  data,
  config,
  width,
}: WidgetComponentProps<NavPerformanceConfig, NavPerformanceData>) {
  const updateConfig = useWidgetStore((s) => s.updateConfig);
  const series = useMemo(() => buildNavSeries(data, config), [data, config]);
  const points = useMemo(
    () => downsample(series.points, chartPointBudget(width)),
    [series.points, width],
  );
  const byDate = useMemo(() => new Map(points.map((p) => [p.date, p])), [points]);
  const rebased = config.mode === 'rebased';
  const setRange = useCallback(
    (range: NavRange) => updateConfig(instanceId, { range }),
    [instanceId, updateConfig],
  );
  const active = series.portfolioReturn - series.benchmarkReturn;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2">
        <dl className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-3"
              style={{ background: PORTFOLIO }}
            />
            <dt className="text-muted">Fund</dt>
            <dd>
              <Delta value={series.portfolioReturn} />
            </dd>
          </div>
          {config.showBenchmark ? (
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-3 border-t border-dashed"
                style={{ borderColor: BENCHMARK }}
              />
              <dt className="text-muted">Nifty 50</dt>
              <dd>
                <Delta value={series.benchmarkReturn} />
              </dd>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5">
            <dt className="text-muted">Active</dt>
            <dd className="num">{formatPct(active)}</dd>
          </div>
        </dl>
        <Segmented<NavRange>
          label="Chart range"
          value={config.range}
          options={NAV_RANGES.map((r) => ({ value: r, label: r }))}
          onValueChange={setRange}
        />
      </div>
      <div className="min-h-0 flex-1 px-1 pb-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: GRID_STROKE }}
              interval={xTickInterval(points.length, width)}
              tickFormatter={(d: string) =>
                formatDateKey(d, config.range === '1M' || config.range === '3M' ? false : true)
              }
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => (rebased ? v.toFixed(0) : `₹${v.toFixed(0)}`)}
            />
            {rebased ? <ReferenceLine y={100} stroke={GRID_STROKE} strokeDasharray="2 2" /> : null}
            <Tooltip
              cursor={CURSOR_STYLE}
              isAnimationActive={false}
              content={<NavTooltip byDate={byDate} rebased={rebased} />}
            />
            {config.showBenchmark ? (
              <Line
                type="linear"
                dataKey="benchmark"
                name="Nifty 50"
                stroke={BENCHMARK}
                strokeWidth={1.25}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
            <Line
              type="linear"
              dataKey="portfolio"
              name="Fund"
              stroke={PORTFOLIO}
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(NavPerformance);
