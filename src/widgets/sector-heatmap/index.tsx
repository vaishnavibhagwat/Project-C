import { scaleBand, scaleLinear } from 'd3';
import { memo, useMemo, useState } from 'react';
import { HoverCard } from '@/components/charts';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { formatPct } from '@/utils/format';
import { formatDateKey } from '@/utils/time';
import { buildHeatModel, cellKey, type HeatCell } from './model';
import type { SectorHeatmapConfig, SectorHeatmapData } from './types';

const LABEL_W = 132;
const HEADER_H = 18;

interface Hover {
  cell: HeatCell;
  x: number;
  y: number;
}

function SectorHeatmap({
  data,
  config,
  width,
  height,
}: WidgetComponentProps<SectorHeatmapConfig, SectorHeatmapData>) {
  const model = useMemo(() => buildHeatModel(data, config), [data, config]);
  const [hover, setHover] = useState<Hover | null>(null);
  const labelW = width < 420 ? 92 : LABEL_W;

  const { x, y, intensity } = useMemo(() => {
    const innerW = Math.max(0, width - labelW - 8);
    const innerH = Math.max(0, height - HEADER_H - 8);
    return {
      x: scaleBand<string>()
        .domain(model.columns.map((c) => c.key))
        .range([labelW, labelW + innerW])
        .paddingInner(0.06),
      y: scaleBand<string>()
        .domain(model.rows.map((r) => r.sector))
        .range([HEADER_H, HEADER_H + innerH])
        .paddingInner(0.08),
      intensity: scaleLinear().domain([0, config.capPct]).range([0.1, 0.92]).clamp(true),
    };
  }, [model, width, height, labelW, config.capPct]);

  if (width === 0 || height === 0) return null;
  const bw = x.bandwidth();
  const bh = y.bandwidth();
  const showText = config.showValues && bw >= 30 && bh >= 12;

  return (
    <div className="relative h-full w-full" onMouseLeave={() => setHover(null)}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Sector returns heat map. A table with the same values follows."
      >
        {model.columns.map((c) => (
          <text
            key={c.key}
            x={(x(c.key) ?? 0) + bw / 2}
            y={12}
            textAnchor="middle"
            fontSize={9}
            fill={c.intraday ? cssColor('accent') : cssColor('textSubtle')}
            fontWeight={c.intraday ? 600 : 400}
          >
            {c.intraday ? 'Live' : bw < 34 ? c.key.slice(8) : formatDateKey(c.key, false)}
          </text>
        ))}
        {model.rows.map((r) => (
          <text
            key={r.sector}
            x={labelW - 6}
            y={(y(r.sector) ?? 0) + bh / 2 + 3}
            textAnchor="end"
            fontSize={10}
            fill={cssColor('textMuted')}
          >
            {labelW < LABEL_W && r.sector.length > 14 ? `${r.sector.slice(0, 13)}…` : r.sector}
          </text>
        ))}
        {model.rows.map((r) =>
          model.columns.map((c) => {
            const cell = model.cells.get(cellKey(r.sector, c.key));
            if (!cell) return null;
            const cx = x(c.key) ?? 0;
            const cy = y(r.sector) ?? 0;
            const a = intensity(Math.abs(cell.returnPct));
            const tone = cell.returnPct >= 0 ? 'positive' : 'negative';
            return (
              <g key={c.key} onMouseEnter={() => setHover({ cell, x: cx + bw / 2, y: cy })}>
                <rect
                  x={cx}
                  y={cy}
                  width={bw}
                  height={bh}
                  rx={1}
                  fill={cssColor(tone)}
                  fillOpacity={a}
                />
                {showText ? (
                  <text
                    x={cx + bw / 2}
                    y={cy + bh / 2 + 3}
                    textAnchor="middle"
                    fontSize={9}
                    className="num"
                    fill={a > 0.55 ? cssColor('bg') : cssColor('text')}
                  >
                    {formatPct(cell.returnPct / 100, 1)}
                  </text>
                ) : null}
              </g>
            );
          }),
        )}
      </svg>
      {hover ? (
        <HoverCard x={hover.x} y={hover.y} containerWidth={width} containerHeight={height}>
          <div className="text-2xs uppercase tracking-wide text-muted">
            {model.columns.find((c) => c.key === hover.cell.column)?.intraday
              ? 'Live session (simulated)'
              : formatDateKey(hover.cell.column)}
          </div>
          <div className="font-medium text-fg">{hover.cell.sector}</div>
          <div className={hover.cell.returnPct >= 0 ? 'num text-pos' : 'num text-neg'}>
            {hover.cell.returnPct >= 0 ? '▲' : '▼'} {formatPct(hover.cell.returnPct / 100)}
          </div>
        </HoverCard>
      ) : null}
      <table className="sr-only">
        <caption>Sector returns by session, percent</caption>
        <thead>
          <tr>
            <th scope="col">Sector</th>
            {model.columns.map((c) => (
              <th key={c.key} scope="col">
                {c.intraday ? 'Live' : c.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((r) => (
            <tr key={r.sector}>
              <th scope="row">{r.sector}</th>
              {model.columns.map((c) => (
                <td key={c.key}>
                  {formatPct((model.cells.get(cellKey(r.sector, c.key))?.returnPct ?? 0) / 100)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(SectorHeatmap);
