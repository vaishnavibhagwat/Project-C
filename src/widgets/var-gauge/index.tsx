import { memo, useMemo } from 'react';
import { Badge } from '@/components/Delta';
import { InfoTooltip } from '@/components/Tooltip';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatMoneyCompact, formatPct } from '@/utils/format';
import { formatDateKey } from '@/utils/time';
import { Gauge } from './Gauge';
import { selectVar, STATUS_LABEL } from './model';
import type { VarGaugeConfig, VarGaugeData } from './types';

const STATUS_TONE = { within: 'positive', near: 'warning', breach: 'negative' } as const;

function Histogram({
  data,
  threshold,
  width,
}: {
  data: VarGaugeData;
  threshold: number;
  width: number;
}) {
  const h = 44;
  const max = Math.max(1, ...data.histogram.map((b) => b.count));
  const lo = data.histogram[0]?.from ?? 0;
  const hi = data.histogram[data.histogram.length - 1]?.to ?? 1;
  const x = (v: number) => ((v - lo) / (hi - lo || 1)) * width;
  const bw = width / Math.max(1, data.histogram.length);
  return (
    <svg width={width} height={h + 12} aria-hidden="true">
      {data.histogram.map((b) => (
        <rect
          key={b.from}
          x={x(b.from) + 0.5}
          y={h - (b.count / max) * h}
          width={Math.max(1, bw - 1)}
          height={(b.count / max) * h}
          fill={b.to <= -threshold ? cssColor('negative') : cssColor('chart5')}
          fillOpacity={b.to <= -threshold ? 0.85 : 0.45}
        />
      ))}
      <line
        x1={x(-threshold)}
        x2={x(-threshold)}
        y1={0}
        y2={h}
        stroke={cssColor('text')}
        strokeDasharray="2 2"
      />
      <text x={x(-threshold) + 3} y={9} fontSize={9} fill={cssColor('textMuted')}>
        VaR
      </text>
      <text x={0} y={h + 11} fontSize={9} fill={cssColor('textSubtle')} className="num">
        {formatPct(lo, 1)}
      </text>
      <text
        x={width}
        y={h + 11}
        fontSize={9}
        textAnchor="end"
        fill={cssColor('textSubtle')}
        className="num"
      >
        {formatPct(hi, 1)}
      </text>
    </svg>
  );
}

function VarGauge({
  data,
  config,
  width,
  height,
}: WidgetComponentProps<VarGaugeConfig, VarGaugeData>) {
  const reading = useMemo(() => selectVar(data, config), [data, config]);
  const fx = data.portfolioValueInr / data.portfolioValueUsd;
  const money = (fraction: number) =>
    formatMoneyCompact(fraction * data.portfolioValueInr, config.currency, fx);
  const size = Math.max(120, Math.min(width - 24, (height - 150) * 1.8, 260));
  const showHist = config.showHistogram && height > 300;
  const rows: { key: string; label: string; v95: number; v99: number }[] = [
    { key: 'h', label: 'Historical', v95: data.historical.var95, v99: data.historical.var99 },
    { key: 'p', label: 'Parametric', v95: data.parametric.var95, v99: data.parametric.var99 },
    { key: 'c', label: 'CVaR (hist.)', v95: data.historical.cvar95, v99: data.historical.cvar99 },
  ];

  return (
    <div className="scroll-thin flex h-full flex-col gap-2 overflow-y-auto px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <Badge tone={STATUS_TONE[reading.status]}>
          {reading.status === 'within' ? '✓ ' : '! '}
          {STATUS_LABEL[reading.status]}
        </Badge>
        <span className="flex items-center text-2xs text-muted">
          {config.confidence}% · 1-day · {data.lookbackDays}d
          <InfoTooltip
            label="VaR assumptions"
            content={
              <ul className="list-disc space-y-1 pl-4">
                {data.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            }
          />
        </span>
      </div>
      <div className="flex flex-col items-center">
        <Gauge
          value={reading.value}
          limit={reading.limit}
          status={reading.status}
          size={size}
          label={formatPct(reading.value, 2, false)}
          sublabel={`${money(reading.value)} · ${Math.round(reading.utilisation * 100)}% of limit`}
        />
        <p className="text-2xs text-muted">
          Limit {config.limitPct.toFixed(1)}% of AUM ({money(reading.limit)}) ·{' '}
          {config.method === 'historical' ? 'Historical simulation' : 'Parametric (normal)'}
        </p>
      </div>
      <table className="w-full text-xs">
        <caption className="sr-only">VaR by method and confidence, percent of AUM</caption>
        <thead>
          <tr className="text-2xs uppercase tracking-wide text-muted">
            <th scope="col" className="py-1 text-left font-medium">
              Method
            </th>
            <th
              scope="col"
              className={cx('py-1 text-right font-medium', config.confidence === '95' && 'text-fg')}
            >
              95%
            </th>
            <th
              scope="col"
              className={cx('py-1 text-right font-medium', config.confidence === '99' && 'text-fg')}
            >
              99%
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <th scope="row" className="py-1 text-left font-normal text-muted">
                {r.label}
              </th>
              <td className="num py-1 text-right">
                {formatPct(r.v95, 2, false)} <span className="text-subtle">{money(r.v95)}</span>
              </td>
              <td className="num py-1 text-right">
                {formatPct(r.v99, 2, false)} <span className="text-subtle">{money(r.v99)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showHist ? (
        <div>
          <p className="mb-1 text-2xs text-muted">
            Daily return distribution · worst {formatPct(data.worstDay.returnPct / 100)} on{' '}
            {formatDateKey(data.worstDay.date)}
          </p>
          <Histogram data={data} threshold={reading.value} width={Math.max(100, width - 24)} />
        </div>
      ) : null}
    </div>
  );
}

export default memo(VarGauge);
