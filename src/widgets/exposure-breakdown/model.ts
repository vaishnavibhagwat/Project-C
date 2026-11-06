import type {
  ExposureBreakdownConfig,
  ExposureBreakdownData,
  ExposureDimension,
  ExposureRow,
} from './types';

type Position = ExposureBreakdownData['positions'][number];

function keyOf(p: Position, d: ExposureDimension): string {
  if (d === 'asset-class') return p.assetClass;
  if (d === 'sector') return p.sector ?? `${p.assetClass} (no sector)`;
  if (d === 'geography') return p.geography;
  return p.currency;
}

/** Market value and economic exposure per group, as % of NAV, largest exposure first. */
export function exposureRows(
  data: ExposureBreakdownData,
  config: ExposureBreakdownConfig,
): ExposureRow[] {
  const nav = data.totalMarketValueInr || 1;
  const groups = new Map<string, { mv: number; ex: number }>();
  for (const p of data.positions) {
    const k = keyOf(p, config.dimension);
    const g = groups.get(k) ?? { mv: 0, ex: 0 };
    g.mv += p.marketValueInr;
    g.ex += p.exposureInr;
    groups.set(k, g);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      marketValuePct: (g.mv / nav) * 100,
      exposurePct: (g.ex / nav) * 100,
    }))
    .sort((a, b) => Math.abs(b.exposurePct) - Math.abs(a.exposurePct));
}

/** Gross (sum of absolute) and net exposure of the whole book, as % of NAV. */
export function grossNet(data: ExposureBreakdownData): { gross: number; net: number } {
  const nav = data.totalMarketValueInr || 1;
  let gross = 0;
  let net = 0;
  for (const p of data.positions) {
    gross += Math.abs(p.exposureInr);
    net += p.exposureInr;
  }
  return { gross: (gross / nav) * 100, net: (net / nav) * 100 };
}

export function exposureSummary(
  data: ExposureBreakdownData,
  config: ExposureBreakdownConfig,
): string {
  const { gross, net } = grossNet(data);
  const top = exposureRows(data, config)[0];
  return `Gross exposure ${gross.toFixed(1)}% and net ${net.toFixed(1)}% of NAV.${top ? ` Largest ${config.dimension.replace('-', ' ')}: ${top.key} ${top.exposurePct.toFixed(1)}% (market value ${top.marketValuePct.toFixed(1)}%).` : ''}`;
}
