import type { AssetAllocationConfig, AssetAllocationData, Slice } from './types';

export const MAX_SECTOR_SLICES = 6;

/** Slices for the chosen view. Sector view groups the tail into "Other" so colours stay distinct. */
export function buildSlices(data: AssetAllocationData, config: AssetAllocationConfig): Slice[] {
  if (config.view === 'asset-class') {
    return data.assetClasses.map((a) => ({
      key: a.id,
      label: a.label,
      valueInr: a.valueInr,
      weightPct: a.weightPct,
    }));
  }
  const sorted = [...data.sectors].sort((a, b) => b.valueInr - a.valueInr);
  const head = sorted.slice(0, MAX_SECTOR_SLICES - 1);
  const tail = sorted.slice(MAX_SECTOR_SLICES - 1);
  const slices: Slice[] = head.map((s) => ({
    key: s.sector,
    label: s.sector,
    valueInr: s.valueInr,
    weightPct: s.weightPct,
  }));
  if (tail.length > 0) {
    slices.push({
      key: 'other',
      label: `Other (${tail.length} sectors)`,
      valueInr: tail.reduce((s, t) => s + t.valueInr, 0),
      weightPct: tail.reduce((s, t) => s + t.weightPct, 0),
    });
  }
  return slices;
}
