import { memo, useMemo } from 'react';
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
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { exposureRows, exposureSummary, grossNet } from './model';
import type {
  ExposureBreakdownConfig,
  ExposureBreakdownData,
  ExposureDimension,
  ExposureRow,
} from './types';

const EXPOSURE = cssColor('chart1');
const MARKET_VALUE = cssColor('textSubtle', 0.6);

function ExposureTooltip({
  active,
  label,
  byKey,
}: TooltipProps<number, string> & { byKey: Map<string, ExposureRow> }) {
  const key: unknown = label;
  if (!active || typeof key !== 'string') return null;
  const r = byKey.get(key);
  if (!r) return null;
  return (
    <ChartTooltipBody
      title={key}
      rows={[
        { key: 'e', label: 'Exposure', value: `${r.exposurePct.toFixed(1)}%`, color: EXPOSURE },
        {
          key: 'm',
          label: 'Market value',
          value: `${r.marketValuePct.toFixed(1)}%`,
          color: MARKET_VALUE,
        },
      ]}
    />
  );
}

function ExposureBreakdown({
  onConfigChange,
  data,
  config,
}: WidgetComponentProps<ExposureBreakdownConfig, ExposureBreakdownData>) {
  const rows = useMemo(() => exposureRows(data, config), [data, config]);
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const { gross, net } = useMemo(() => grossNet(data), [data]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 text-xs">
        <dl className="flex gap-3">
          <div className="flex gap-1">
            <dt className="text-muted">Gross</dt>
            <dd className="num text-fg">{gross.toFixed(1)}%</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted">Net</dt>
            <dd className="num text-fg">{net.toFixed(1)}%</dd>
          </div>
        </dl>
        <Segmented<ExposureDimension>
          label="Group exposure by"
          value={config.dimension}
          options={[
            { value: 'asset-class', label: 'Class' },
            { value: 'sector', label: 'Sector' },
            { value: 'geography', label: 'Region' },
            { value: 'currency', label: 'Ccy' },
          ]}
          onValueChange={(dimension) => onConfigChange({ dimension })}
        />
      </div>
      <p className="px-3 text-2xs text-muted">
        % of NAV. Futures at notional, options delta-adjusted.
      </p>
      <p className="sr-only" role="status">
        {exposureSummary(data, config)}
      </p>
      <div className="min-h-0 flex-1 px-1 pb-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
            <XAxis
              type="number"
              tick={AXIS_TICK}
              tickLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <YAxis
              type="category"
              dataKey="key"
              width={96}
              tick={AXIS_TICK}
              tickLine={false}
              interval={0}
              tickFormatter={(v: string) => (v.length > 15 ? `${v.slice(0, 14)}…` : v)}
            />
            <ReferenceLine x={0} stroke={cssColor('borderStrong')} />
            <Tooltip
              isAnimationActive={false}
              cursor={{ fill: cssColor('raised', 0.6) }}
              content={<ExposureTooltip byKey={byKey} />}
            />
            <Bar dataKey="exposurePct" name="Exposure" fill={EXPOSURE} isAnimationActive={false} />
            {config.showMarketValue ? (
              <Bar
                dataKey="marketValuePct"
                name="Market value"
                fill={MARKET_VALUE}
                isAnimationActive={false}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(ExposureBreakdown);
