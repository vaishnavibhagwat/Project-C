import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type { HeatCell, PlacedCell } from './types';

// Kept apart from model.ts so config.ts (main bundle) does not pull in D3.

/** Squarified treemap (D3) of the cells, sized by market value, largest first. */
export function layoutCells(
  cells: readonly HeatCell[],
  width: number,
  height: number,
): PlacedCell[] {
  if (width <= 0 || height <= 0 || cells.length === 0) return [];
  const root = hierarchy<{ cell?: HeatCell; children?: { cell: HeatCell }[] }>({
    children: cells.map((cell) => ({ cell })),
  })
    .sum((d) => Math.max(0, d.cell?.marketValueInr ?? 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const laid = treemap<{ cell?: HeatCell }>()
    .tile(treemapSquarify.ratio(1.3))
    .size([width, height])
    .paddingInner(2)
    .round(true)(root);
  return laid.leaves().flatMap((leaf) =>
    leaf.data.cell
      ? [
          {
            ...leaf.data.cell,
            x: leaf.x0,
            y: leaf.y0,
            w: leaf.x1 - leaf.x0,
            h: leaf.y1 - leaf.y0,
          },
        ]
      : [],
  );
}
