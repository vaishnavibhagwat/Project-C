import { scaleLinear } from 'd3';
import { unrealisedPnLPercent } from '@/utils/holdings';
import { memo, useMemo, useState } from 'react';
import { HoverCard } from '@/components/charts';
import type { Holding } from '@/types';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { formatInrCompact, formatPct } from '@/utils/format';
import { buildTree, colorMetric, layoutTreemap } from './model';
import type { HoldingsTreemapConfig, HoldingsTreemapData } from './types';

interface Hover {
  holding: Holding;
  x: number;
  y: number;
}

function HoldingsTreemap({
  data,
  config,
  width,
  height,
}: WidgetComponentProps<HoldingsTreemapConfig, HoldingsTreemapData>) {
  const [hover, setHover] = useState<Hover | null>(null);
  const grouped = config.groupBy === 'sector';
  const root = useMemo(
    () =>
      width > 0 && height > 0
        ? layoutTreemap(buildTree(data, config), width, height, grouped)
        : null,
    [data, config, width, height, grouped],
  );
  const intensity = useMemo(
    () => scaleLinear().domain([0, config.capPct]).range([0.12, 0.9]).clamp(true),
    [config.capPct],
  );

  if (!root) return null;
  const leaves = root.leaves();
  const groups = grouped ? (root.children ?? []) : [];

  return (
    <div className="relative h-full w-full" onMouseLeave={() => setHover(null)}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Holdings treemap sized by market value"
      >
        {groups.map((g) => (
          <g key={g.data.name}>
            <rect
              x={g.x0}
              y={g.y0}
              width={g.x1 - g.x0}
              height={g.y1 - g.y0}
              fill={cssColor('raised')}
            />
            {g.x1 - g.x0 > 50 ? (
              <text
                x={g.x0 + 3}
                y={g.y0 + 10}
                fontSize={9}
                fill={cssColor('textMuted')}
                fontWeight={600}
              >
                {g.data.name.length * 5 > g.x1 - g.x0
                  ? `${g.data.name.slice(0, Math.floor((g.x1 - g.x0) / 5.5))}…`
                  : g.data.name}
              </text>
            ) : null}
          </g>
        ))}
        {leaves.map((leaf) => {
          const h = leaf.data.holding;
          if (!h) return null;
          const w = leaf.x1 - leaf.x0;
          const ht = leaf.y1 - leaf.y0;
          const metric = colorMetric(h, config);
          const a = intensity(Math.abs(metric));
          const fill = cssColor(metric >= 0 ? 'positive' : 'negative');
          const textFill = a > 0.55 ? cssColor('bg') : cssColor('text');
          return (
            <g
              key={h.ticker}
              onMouseEnter={() => setHover({ holding: h, x: leaf.x0 + w / 2, y: leaf.y0 + ht / 2 })}
            >
              <rect x={leaf.x0} y={leaf.y0} width={w} height={ht} fill={cssColor('panel')} />
              <rect x={leaf.x0} y={leaf.y0} width={w} height={ht} fill={fill} fillOpacity={a} />
              {w > h.ticker.length * 6.4 + 8 && ht > 26 ? (
                <>
                  <text
                    x={leaf.x0 + 4}
                    y={leaf.y0 + 12}
                    fontSize={10}
                    fontWeight={600}
                    fill={textFill}
                  >
                    {h.ticker}
                  </text>
                  <text
                    x={leaf.x0 + 4}
                    y={leaf.y0 + 23}
                    fontSize={9}
                    className="num"
                    fill={textFill}
                  >
                    {formatPct(metric / 100, 1)}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover ? (
        <HoverCard x={hover.x} y={hover.y} containerWidth={width} containerHeight={height}>
          <div className="font-medium text-fg">
            {hover.holding.ticker} <span className="text-muted">· {hover.holding.sector}</span>
          </div>
          <div className="num mt-1 grid grid-cols-2 gap-x-2 text-2xs">
            <span className="text-muted">Weight</span>
            <span className="text-right">{hover.holding.weight.toFixed(2)}%</span>
            <span className="text-muted">Value</span>
            <span className="text-right">{formatInrCompact(hover.holding.marketValue)}</span>
            <span className="text-muted">Day</span>
            <span
              className={
                hover.holding.dailyPnLPercent >= 0 ? 'text-right text-pos' : 'text-right text-neg'
              }
            >
              {formatPct(hover.holding.dailyPnLPercent / 100)}
            </span>
            <span className="text-muted">Unrealised</span>
            <span
              className={
                unrealisedPnLPercent(hover.holding) >= 0
                  ? 'text-right text-pos'
                  : 'text-right text-neg'
              }
            >
              {formatPct(unrealisedPnLPercent(hover.holding) / 100)}
            </span>
          </div>
        </HoverCard>
      ) : null}
    </div>
  );
}

export default memo(HoldingsTreemap);
