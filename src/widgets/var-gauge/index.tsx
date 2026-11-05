import { memo, useCallback, useMemo } from 'react';
import { Badge } from '@/components/Badge';
import { Segmented } from '@/components/FormControls';
import { InfoTooltip } from '@/components/Tooltip';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { cx } from '@/utils/cx';
import { formatMoneyCompact, formatPct } from '@/utils/format';
import { formatDateKey } from '@/utils/time';
import { Gauge } from './Gauge';
import { gaugeMax, rangeFor, selectVar, statusLabel } from './model';
import type { VarGaugeConfig, VarGaugeData } from './types';

const STATUS_TONE = { within: 'positive', near: 'warning', breach: 'negative' } as const;
const STATUS_MARK = { within: '✓', near: '!', breach: '▲' } as const;
/** Text under the dial: one line (VaR and % of limit) when short, two with the detail line. */
const ONE_LINE_PX = 20;
const TWO_LINES_PX = 46;
const TOOLBAR_PX = 28;
/** Below this body height only the first text line is shown. */
const COMPACT_BELOW_PX = 170;

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
  onConfigChange,
  data,
  config,
  width,
  height,
}: WidgetComponentProps<VarGaugeConfig, VarGaugeData>) {
  const reading = useMemo(() => selectVar(data, config), [data, config]);
  const range = useMemo(() => rangeFor(data, config), [data, config]);
  const max = gaugeMax(reading, range);
  const fx = data.portfolioValueInr / data.portfolioValueUsd;
  const money = (fraction: number) =>
    formatMoneyCompact(fraction * data.portfolioValueInr, config.currency, fx);
  // The dial is twice as wide as it is tall; fit it in what the toolbar and text leave.
  const compact = height < COMPACT_BELOW_PX;
  const dialRoom = height - TOOLBAR_PX - (compact ? ONE_LINE_PX : TWO_LINES_PX) - 10;
  const size = Math.round(Math.max(64, Math.min(width - 16, dialRoom * 2, 280)));
  const showTable = height >= 300;
  const showHist = config.showHistogram && height >= 420;
  const setConfidence = useCallback(
    (confidence: VarGaugeConfig['confidence']) => onConfigChange({ confidence }),
    [onConfigChange],
  );
  const setMethod = useCallback(
    (method: VarGaugeConfig['method']) => onConfigChange({ method }),
    [onConfigChange],
  );
  const rows = [
    { key: 'h', label: 'Historical', v95: data.historical.var95, v99: data.historical.var99 },
    { key: 'p', label: 'Parametric', v95: data.parametric.var95, v99: data.parametric.var99 },
    { key: 'c', label: 'CVaR (hist.)', v95: data.historical.cvar95, v99: data.historical.cvar99 },
  ];

  return (
    <div className="scroll-thin flex h-full flex-col overflow-y-auto px-2 py-1">
      <div className="flex items-center justify-between gap-1">
        <Segmented<VarGaugeConfig['confidence']>
          label="Confidence"
          value={config.confidence}
          options={[
            { value: '95', label: '95%' },
            { value: '99', label: '99%' },
          ]}
          onValueChange={setConfidence}
        />
        <Segmented<VarGaugeConfig['method']>
          label="VaR method"
          value={config.method}
          options={[
            { value: 'historical', label: 'Hist' },
            { value: 'parametric', label: 'Param' },
          ]}
          onValueChange={setMethod}
        />
      </div>
      <div className="flex flex-col items-center">
        <Gauge value={reading.value} limit={reading.limit} max={max} range={range} size={size} />
        <p className="num -mt-1 flex flex-wrap items-baseline justify-center gap-x-1.5 text-center leading-tight">
          <span className="text-sm font-semibold text-fg">{money(reading.value)}</span>
          <span
            className={cx(
              'text-xs font-medium',
              reading.status === 'within'
                ? 'text-pos'
                : reading.status === 'near'
                  ? 'text-warn'
                  : 'text-neg',
            )}
          >
            <span aria-hidden="true">{STATUS_MARK[reading.status]} </span>
            {Math.round(reading.utilisation * 100)}% of limit
          </span>
        </p>
        <p
          className={cx('num text-center text-2xs leading-tight text-muted', compact && 'sr-only')}
        >
          {formatPct(reading.value, 2, false)} of AUM · {config.confidence}% 1-day ·{' '}
          {config.method === 'historical' ? 'historical' : 'parametric'}
          {range
            ? ` · ${range.days}d range ${formatPct(range.min, 2, false)}–${formatPct(range.max, 2, false)}`
            : ''}
        </p>
      </div>
      {showTable ? (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Badge tone={STATUS_TONE[reading.status]}>
              {STATUS_MARK[reading.status]} {statusLabel(reading)}
            </Badge>
            <span className="flex items-center text-2xs text-muted">
              Limit {config.limitPct.toFixed(1)}% ({money(reading.limit)})
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
          <table className="w-full text-xs">
            <caption className="sr-only">VaR by method and confidence, percent of AUM</caption>
            <thead>
              <tr className="text-2xs uppercase tracking-wide text-muted">
                <th scope="col" className="py-1 text-left font-medium">
                  Method
                </th>
                <th
                  scope="col"
                  className={cx(
                    'py-1 text-right font-medium',
                    config.confidence === '95' && 'text-fg',
                  )}
                >
                  95%
                </th>
                <th
                  scope="col"
                  className={cx(
                    'py-1 text-right font-medium',
                    config.confidence === '99' && 'text-fg',
                  )}
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
        </div>
      ) : null}
      {showHist ? (
        <div className="mt-2">
          <p className="mb-1 text-2xs text-muted">
            Daily return distribution · worst {formatPct(data.worstDay.returnPct / 100)} on{' '}
            {formatDateKey(data.worstDay.date)}
          </p>
          <Histogram data={data} threshold={reading.value} width={Math.max(100, width - 16)} />
        </div>
      ) : null}
    </div>
  );
}

export default memo(VarGauge);
