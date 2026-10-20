import { memo, useCallback, useMemo } from 'react';
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
import { Delta } from '@/components/Delta';
import { Segmented } from '@/components/FormControls';
import { InfoTooltip } from '@/components/Tooltip';
import type { AttributionRow } from '@/data/schemas';
import { useWidgetStore } from '@/store/widgetStore';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { formatPct } from '@/utils/format';
import {
  ATTRIBUTION_PERIOD_OPTIONS,
  type SectorAttributionConfig,
  type SectorAttributionData,
} from './types';

type Period = SectorAttributionConfig['period'];

const ALLOC = cssColor('chart1');
const SELECT = cssColor('chart2');
const bp = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)} bp`;

function AttributionTooltip({
  active,
  label,
  bySector,
}: TooltipProps<number, string> & { bySector: Map<string, AttributionRow> }) {
  const key: unknown = label;
  if (!active || typeof key !== 'string') return null;
  const r = bySector.get(key);
  if (!r) return null;
  return (
    <ChartTooltipBody
      title={key}
      rows={[
        {
          key: 'w',
          label: 'Weight (P / B)',
          value: `${r.portfolioWeightPct.toFixed(1)}% / ${r.benchmarkWeightPct.toFixed(1)}%`,
        },
        {
          key: 'r',
          label: 'Return (P / B)',
          value: `${formatPct(r.portfolioReturnPct / 100, 1)} / ${formatPct(r.benchmarkReturnPct / 100, 1)}`,
        },
        { key: 'a', label: 'Allocation', value: bp(r.allocationPct), color: ALLOC },
        { key: 's', label: 'Selection', value: bp(r.selectionPct), color: SELECT },
        { key: 't', label: 'Total', value: bp(r.totalPct) },
      ]}
    />
  );
}

function SectorAttribution({
  instanceId,
  data,
  config,
  width,
}: WidgetComponentProps<SectorAttributionConfig, SectorAttributionData>) {
  const updateConfig = useWidgetStore((s) => s.updateConfig);
  const period = useMemo(
    () => data.periods.find((p) => p.period === config.period) ?? data.periods[0],
    [data, config.period],
  );
  const rows = useMemo(() => period?.rows ?? [], [period]);
  const bySector = useMemo(() => new Map(rows.map((r) => [r.sector, r])), [rows]);
  const setPeriod = useCallback(
    (p: Period) => updateConfig(instanceId, { period: p }),
    [instanceId, updateConfig],
  );
  const showTable = config.showTable && width >= 900;
  if (!period) return null;
  const active = (period.portfolioReturnPct - period.benchmarkReturnPct) / 100;
  const stacked = config.effect === 'stacked';

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 text-xs">
        <dl className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <dt className="text-muted">Equity sleeve</dt>
            <dd>
              <Delta value={period.portfolioReturnPct / 100} />
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">Nifty 50</dt>
            <dd>
              <Delta value={period.benchmarkReturnPct / 100} />
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">Active</dt>
            <dd className="num">{bp(active)}</dd>
          </div>
          <InfoTooltip label="Attribution methodology" content={data.methodology} />
        </dl>
        <div className="flex items-center gap-3">
          {stacked ? (
            <span className="flex items-center gap-2 text-2xs text-muted">
              <span className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-sm"
                  style={{ background: ALLOC }}
                />
                Allocation
              </span>
              <span className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-sm"
                  style={{ background: SELECT }}
                />
                Selection
              </span>
            </span>
          ) : null}
          <Segmented<Period>
            label="Attribution period"
            value={config.period}
            options={ATTRIBUTION_PERIOD_OPTIONS.map((p) => ({ value: p, label: p }))}
            onValueChange={setPeriod}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-2 px-1 pb-1">
        <div className="min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
              barCategoryGap={3}
            >
              <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
              <XAxis
                type="number"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}bp`}
              />
              <YAxis
                type="category"
                dataKey="sector"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={width < 520 ? 92 : 140}
                interval={0}
              />
              <ReferenceLine x={0} stroke={cssColor('borderStrong')} />
              <Tooltip
                cursor={{ fill: 'rgb(var(--color-raised))' }}
                isAnimationActive={false}
                content={<AttributionTooltip bySector={bySector} />}
              />
              {stacked || config.effect === 'allocation' ? (
                <Bar
                  dataKey="allocationPct"
                  stackId={stacked ? 'a' : undefined}
                  fill={ALLOC}
                  isAnimationActive={false}
                />
              ) : null}
              {stacked || config.effect === 'selection' ? (
                <Bar
                  dataKey="selectionPct"
                  stackId={stacked ? 'a' : undefined}
                  fill={SELECT}
                  isAnimationActive={false}
                />
              ) : null}
              {config.effect === 'total' ? (
                <Bar dataKey="totalPct" fill={cssColor('chart1')} isAnimationActive={false} />
              ) : null}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {showTable ? (
          <div className="scroll-thin w-[46%] overflow-y-auto">
            <table className="w-full text-xs">
              <caption className="sr-only">Attribution by sector, {config.period}</caption>
              <thead className="sticky top-0 bg-panel">
                <tr className="text-2xs uppercase tracking-wide text-muted">
                  <th scope="col" className="py-1 text-left font-medium">
                    Sector
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Wt P/B
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Ret P/B
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Alloc
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Select
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sector} className="border-t border-line">
                    <th scope="row" className="truncate py-1 text-left font-normal">
                      {r.sector}
                    </th>
                    <td className="num py-1 text-right text-muted">
                      {r.portfolioWeightPct.toFixed(1)}/{r.benchmarkWeightPct.toFixed(1)}
                    </td>
                    <td className="num py-1 text-right text-muted">
                      {formatPct(r.portfolioReturnPct / 100, 1)}/
                      {formatPct(r.benchmarkReturnPct / 100, 1)}
                    </td>
                    <td className="num py-1 text-right">{bp(r.allocationPct)}</td>
                    <td className="num py-1 text-right">{bp(r.selectionPct)}</td>
                    <td className="py-1 text-right">
                      <Delta value={r.totalPct} text={bp(r.totalPct)} arrow={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default memo(SectorAttribution);
