import type { Sector } from '@/types';
import type { SectorHeatmapConfig, SectorHeatmapData } from './types';

export interface HeatCell {
  sector: Sector;
  column: string;
  returnPct: number;
}

export interface HeatModel {
  rows: { sector: Sector; weightPct: number; latest: number }[];
  columns: SectorHeatmapData['columns'];
  cells: Map<string, HeatCell>;
}

export const cellKey = (sector: string, column: string) => `${sector}|${column}`;

/** Select the trailing N daily columns (+ live column) and order rows. */
export function buildHeatModel(data: SectorHeatmapData, config: SectorHeatmapConfig): HeatModel {
  const days = Number(config.days);
  const daily = data.columns.filter((c) => !c.intraday).slice(-days);
  const live = data.columns.filter((c) => c.intraday);
  const columns = [...daily, ...live];
  const keep = new Set(columns.map((c) => c.key));
  const cells = new Map<string, HeatCell>();
  for (const c of data.cells) {
    if (keep.has(c.column)) cells.set(cellKey(c.sector, c.column), c);
  }
  const lastKey = columns[columns.length - 1]?.key ?? '';
  const rows = data.sectors.map((sector) => ({
    sector,
    weightPct: data.cells.find((c) => c.sector === sector)?.weightPct ?? 0,
    latest: cells.get(cellKey(sector, lastKey))?.returnPct ?? 0,
  }));
  rows.sort((a, b) => {
    if (config.sortBy === 'name') return a.sector.localeCompare(b.sector);
    if (config.sortBy === 'latest') return b.latest - a.latest;
    return b.weightPct - a.weightPct;
  });
  return { rows, columns, cells };
}
