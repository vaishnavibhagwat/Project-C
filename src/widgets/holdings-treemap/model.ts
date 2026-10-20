import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3';
import type { Holding } from '@/data/schemas';
import type { HoldingsTreemapConfig, HoldingsTreemapData, TreeDatum } from './types';

export function buildTree(data: HoldingsTreemapData, config: HoldingsTreemapConfig): TreeDatum {
  const leaf = (h: Holding): TreeDatum => ({ name: h.symbol, holding: h });
  if (config.groupBy === 'none') return { name: 'Portfolio', children: data.holdings.map(leaf) };
  const bySector = new Map<string, Holding[]>();
  for (const h of data.holdings) bySector.set(h.sector, [...(bySector.get(h.sector) ?? []), h]);
  return {
    name: 'Portfolio',
    children: [...bySector.entries()].map(([sector, list]) => ({
      name: sector,
      children: list.map(leaf),
    })),
  };
}

export function colorMetric(h: Holding, config: HoldingsTreemapConfig): number {
  return config.colorBy === 'dayChange' ? h.dayChangePct : h.unrealisedPnlPct;
}

/** Squarified treemap sized by market value (D3 hierarchy + treemap layout). */
export function layoutTreemap(
  tree: TreeDatum,
  width: number,
  height: number,
  grouped: boolean,
): HierarchyRectangularNode<TreeDatum> {
  const root = hierarchy(tree)
    .sum((d) => d.holding?.marketValueInr ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return treemap<TreeDatum>()
    .tile(treemapSquarify.ratio(1.3))
    .size([width, height])
    .paddingInner(1)
    .paddingTop((node) => (grouped && node.depth === 1 ? 14 : 0))
    .round(true)(root);
}
