import { memo, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { AXIS_TICK, ChartTooltipBody, GRID_STROKE } from '@/components/charts';
import { Segmented } from '@/components/FormControls';
import { useRiskSettings } from '@/hooks/useRiskSettings';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { formatInrCompact } from '@/utils/format';
import {
  basisFromConfig,
  contributionRows,
  contributionSummary,
  portfolioVar,
  type RiskBasis,
} from './model';
import type { ContributionRow, RiskContributionConfig, RiskContributionWidgetData } from './types';

const ADDS = cssColor('negative');
const REDUCES = cssColor('positive');

function RowTooltip({
  active,
  label,
  byTicker,
}: TooltipProps<number, string> & { byTicker: Map<string, ContributionRow> }) {
  const key: unknown = label;
  if (!active || typeof key !== 'string') return null;
  const r = byTicker.get(key);
  if (!r) return null;
  return (
    <ChartTooltipBody
      title={`${r.ticker} · ${r.name}`}
      rows={[
        { key: 'v', label: 'Component VaR', value: formatInrCompact(r.varInr, true) },
        { key: 's', label: 'Share of risk', value: `${r.sharePct.toFixed(1)}%` },
        { key: 'w', label: 'Weight', value: `${r.weightPct.toFixed(1)}%` },
      ]}
    />
  );
}

function RiskContribution({
  onConfigChange,
  data,
  config,
}: WidgetComponentProps<RiskContributionConfig, RiskContributionWidgetData>) {
  // On the Risk page the page's confidence and horizon apply; elsewhere the widget's own.
  const page = useRiskSettings();
  const basis: RiskBasis = useMemo(
    () =>
      page
        ? { confidence: page.confidence, horizonDays: page.horizonDays }
        : basisFromConfig(config),
    [page, config],
  );
  const top = Number(config.top);
  const rows = useMemo(() => contributionRows(data, basis, top), [data, basis, top]);
  const byTicker = useMemo(() => new Map(rows.map((r) => [r.ticker, r])), [rows]);
  const total = portfolioVar(data, basis);
  const key = config.measure === 'var' ? 'varInr' : 'sharePct';

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 text-xs">
        <span className="text-muted">
          {basis.confidence}% {basis.horizonDays}-day VaR{' '}
          <span className="num font-semibold text-fg">{formatInrCompact(total)}</span>
          {page ? <span className="text-subtle"> · page setting</span> : null}
        </span>
        <Segmented<RiskContributionConfig['measure']>
          label="Measure"
          value={config.measure}
          options={[
            { value: 'var', label: '₹ VaR' },
            { value: 'share', label: '% of risk' },
          ]}
          onValueChange={(measure) => onConfigChange({ measure })}
        />
      </div>
      <p className="px-3 text-2xs text-muted">
        Top {top} by size. <span className="text-neg">■ adds risk</span> ·{' '}
        <span className="text-pos">■ reduces risk</span>
      </p>
      <p className="sr-only" role="status">
        {contributionSummary(data, basis, top)}
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
              tickFormatter={(v: number) =>
                config.measure === 'var' ? formatInrCompact(v) : `${v.toFixed(0)}%`
              }
            />
            <YAxis
              type="category"
              dataKey="ticker"
              width={86}
              tick={AXIS_TICK}
              tickLine={false}
              interval={0}
              tickFormatter={(v: string) => (v.length > 13 ? `${v.slice(0, 12)}…` : v)}
            />
            <ReferenceLine x={0} stroke={cssColor('borderStrong')} />
            <Tooltip
              isAnimationActive={false}
              cursor={{ fill: cssColor('raised', 0.6) }}
              content={<RowTooltip byTicker={byTicker} />}
            />
            <Bar dataKey={key} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.key} fill={r.varInr >= 0 ? ADDS : REDUCES} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(RiskContribution);
