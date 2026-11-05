import { memo, useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { HoverCard } from '@/components/charts';
import { IconChevronLeft } from '@/components/Icons';
import { useElementSize } from '@/hooks/useElementSize';
import { cssColor } from '@/theme/themes';
import type { WidgetComponentProps } from '@/types';
import { formatInrCompact, formatPct } from '@/utils/format';
import { layoutCells } from './layout';
import {
  cellFill,
  describeCell,
  directionMark,
  holdingCells,
  scopedHoldings,
  sectorCells,
  SCALE_TOKENS,
  summarizeHeatMap,
} from './model';
import type { HeatCell, PlacedCell, SectorHeatMapConfig, SectorHeatMapData } from './types';

/** Height of the toolbar row above the treemap, used before the plot has been measured. */
const TOOLBAR_PX = 30;

interface Hover {
  cell: HeatCell;
  x: number;
  y: number;
}

/** Average width of a bold 10 px glyph (upper-case tickers are the widest case). */
const NAME_CHAR_PX = 6.6;

/** The label, shortened with an ellipsis to fit `px`; null when not even 3 letters fit. */
export function fitLabel(label: string, px: number): string | null {
  const fit = Math.floor(px / NAME_CHAR_PX);
  if (label.length <= fit) return label;
  return fit >= 4 ? `${label.slice(0, fit - 1)}…` : null;
}

function CellLabel({ cell, textFill }: { cell: PlacedCell; textFill: string }) {
  const mark = directionMark(cell.pnlPct);
  const pct = `${mark} ${formatPct(cell.pnlPct / 100, Math.abs(cell.pnlPct) < 0.1 ? 2 : 1)}`;
  const name = fitLabel(cell.label, cell.w - 8);
  const fitsPct = cell.w > pct.length * 5.4 + 6 && cell.h > 14;
  if (name && cell.h > 28) {
    return (
      <>
        <text x={cell.x + 4} y={cell.y + 12} fontSize={10} fontWeight={600} fill={textFill}>
          {name}
        </text>
        {fitsPct ? (
          <text x={cell.x + 4} y={cell.y + 24} fontSize={9} className="num" fill={textFill}>
            {pct}
          </text>
        ) : null}
      </>
    );
  }
  if (fitsPct) {
    return (
      <text x={cell.x + 3} y={cell.y + 11} fontSize={9} className="num" fill={textFill}>
        {pct}
      </text>
    );
  }
  // Too small for text: the sign alone, so colour is still not the only cue.
  return cell.w >= 10 && cell.h >= 10 ? (
    <text
      x={cell.x + cell.w / 2}
      y={cell.y + cell.h / 2}
      fontSize={8}
      textAnchor="middle"
      dominantBaseline="central"
      fill={textFill}
    >
      {mark}
    </text>
  ) : null;
}

function SectorHeatMap({
  data,
  config,
  width,
  height,
}: WidgetComponentProps<SectorHeatMapConfig, SectorHeatMapData>) {
  const holdings = useMemo(() => scopedHoldings(data, config), [data, config]);
  const sectors = useMemo(() => sectorCells(holdings), [holdings]);
  const [zoom, setZoom] = useState<string | null>(null);
  // A sector that is no longer in scope (scope changed, data refreshed) falls back to the top.
  const sector = zoom !== null && sectors.some((s) => s.key === zoom) ? zoom : null;
  const cells = useMemo(
    () => (sector === null ? sectors : holdingCells(holdings, sector)),
    [holdings, sector, sectors],
  );
  const zoomedSector = sectors.find((s) => s.key === sector);

  const [plotRef, measured] = useElementSize<HTMLDivElement>();
  const plotW = measured.width || width;
  const plotH = measured.height || Math.max(0, height - TOOLBAR_PX);
  const placed = useMemo(() => layoutCells(cells, plotW, plotH), [cells, plotW, plotH]);
  const [hover, setHover] = useState<Hover | null>(null);

  const open = useCallback(
    (cell: HeatCell) => {
      if (sector !== null) return;
      setHover(null);
      setZoom(cell.key);
    },
    [sector],
  );
  const back = useCallback(() => {
    setHover(null);
    setZoom(null);
  }, []);
  const onKey = (cell: HeatCell) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(cell);
    }
  };
  const tokens = SCALE_TOKENS[config.colorScale];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[30px] shrink-0 items-center justify-between gap-2 px-2 text-xs">
        {zoomedSector ? (
          <nav aria-label="Heat map level" className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={back}
              className="flex items-center gap-0.5 rounded px-1 py-0.5 text-muted hover:bg-raised hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              <IconChevronLeft size={14} aria-hidden="true" />
              Back
            </button>
            <span className="truncate text-fg">{zoomedSector.label}</span>
            <span className="num shrink-0 text-muted">
              {directionMark(zoomedSector.pnlPct)} {formatPct(zoomedSector.pnlPct / 100, 2)}
            </span>
          </nav>
        ) : (
          <span className="truncate text-2xs uppercase tracking-wide text-muted">
            {config.scope === 'all' ? 'Book by sector' : 'Equity by sector'} · click to zoom
          </span>
        )}
        <span
          className="num flex shrink-0 items-center gap-1 text-2xs text-muted"
          aria-hidden="true"
        >
          <span>▼ −{config.capPct}%</span>
          <span
            className="inline-block h-2 w-14 rounded-sm"
            style={{
              background: `linear-gradient(to right, ${cssColor(tokens.down, 0.9)}, ${cssColor('textSubtle', 0.18)}, ${cssColor(tokens.up, 0.9)})`,
            }}
          />
          <span>▲ +{config.capPct}%</span>
        </span>
      </div>
      <p className="sr-only" role="status">
        {zoomedSector ? `${zoomedSector.label} holdings. ` : 'Sectors. '}
        {summarizeHeatMap(cells)}
      </p>
      <div ref={plotRef} className="relative min-h-0 flex-1" onMouseLeave={() => setHover(null)}>
        <svg
          width={plotW}
          height={plotH}
          role="group"
          aria-label={
            zoomedSector
              ? `${zoomedSector.label} holdings sized by market value, coloured by day P&L`
              : 'Sectors sized by market value, coloured by day P&L. Select a sector to see its holdings.'
          }
        >
          {placed.map((cell) => {
            const { fill, opacity } = cellFill(cell.pnlPct, config);
            const textFill = opacity > 0.55 ? cssColor('bg') : cssColor('text');
            const show = () => setHover({ cell, x: cell.x + cell.w / 2, y: cell.y + cell.h / 2 });
            return (
              <g
                key={cell.key}
                role={sector === null ? 'button' : 'img'}
                tabIndex={0}
                aria-label={`${describeCell(cell)}${sector === null ? ' Show holdings.' : ''}`}
                className="outline-none focus-visible:[&>rect:last-of-type]:stroke-focus"
                cursor={sector === null ? 'pointer' : 'default'}
                onClick={() => open(cell)}
                onKeyDown={onKey(cell)}
                onMouseEnter={show}
                onFocus={show}
                onBlur={() => setHover(null)}
              >
                <rect
                  x={cell.x}
                  y={cell.y}
                  width={cell.w}
                  height={cell.h}
                  fill={cssColor('panel')}
                />
                <rect
                  x={cell.x}
                  y={cell.y}
                  width={cell.w}
                  height={cell.h}
                  fill={fill}
                  fillOpacity={opacity}
                  strokeWidth={2}
                />
                <CellLabel cell={cell} textFill={textFill} />
              </g>
            );
          })}
        </svg>
        {hover ? (
          <HoverCard x={hover.x} y={hover.y} containerWidth={plotW} containerHeight={plotH}>
            <div className="truncate font-medium text-fg">{hover.cell.name}</div>
            <div className="num mt-1 grid grid-cols-2 gap-x-2 text-2xs">
              <span className="text-muted">Market value</span>
              <span className="text-right">{formatInrCompact(hover.cell.marketValueInr)}</span>
              <span className="text-muted">Day P&amp;L</span>
              <span
                className={hover.cell.pnlInr >= 0 ? 'text-right text-pos' : 'text-right text-neg'}
              >
                {formatInrCompact(hover.cell.pnlInr, true)}
              </span>
              <span className="text-muted">Day P&amp;L %</span>
              <span
                className={hover.cell.pnlPct >= 0 ? 'text-right text-pos' : 'text-right text-neg'}
              >
                {directionMark(hover.cell.pnlPct)} {formatPct(hover.cell.pnlPct / 100, 2)}
              </span>
              <span className="text-muted">Holdings</span>
              <span className="text-right">{hover.cell.holdingsCount}</span>
            </div>
          </HoverCard>
        ) : null}
      </div>
    </div>
  );
}

export default memo(SectorHeatMap);
