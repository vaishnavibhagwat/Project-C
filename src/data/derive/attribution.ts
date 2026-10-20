import type { Sector } from '@/types';
import type { AttributionData, AttributionPeriod } from '../schemas';
import { asOfIso, round, type DeriveContext } from './context';

export const ATTRIBUTION_PERIODS: { period: AttributionPeriod; days: number }[] = [
  { period: '1M', days: 21 },
  { period: '3M', days: 63 },
  { period: '6M', days: 126 },
  { period: '1Y', days: 252 },
];

export const ATTRIBUTION_METHODOLOGY =
  'Single-period Brinson-Fachler sector attribution of the equity sleeve against the Nifty 50. ' +
  'Simplification: portfolio and benchmark weights are held at current values for the whole ' +
  'period (buy-and-hold, no intra-period rebalancing or cash flows); interaction is included ' +
  'in selection. Benchmark weights are approximate. Not a GIPS-compliant calculation.';

interface Bucket {
  pw: number;
  bw: number;
  pr: number;
  br: number;
}

export function deriveAttribution(ctx: DeriveContext): AttributionData {
  const { dataset } = ctx;
  const closes = dataset.stockCloses;
  const lastIndex = dataset.dates.length - 1;

  const holdingValue = dataset.holdings.map((h) => {
    const series = closes[h.constituentIndex] ?? [];
    return h.quantity * (series[lastIndex] ?? 0);
  });
  const equity = holdingValue.reduce((s, v) => s + v, 0);

  const periods = ATTRIBUTION_PERIODS.map(({ period, days }) => {
    const startIndex = Math.max(0, lastIndex - days);
    const stockReturn = (i: number) => {
      const series = closes[i] ?? [];
      const start = series[startIndex] ?? 0;
      return start === 0 ? 0 : (series[lastIndex] ?? start) / start - 1;
    };

    const buckets = new Map<Sector, Bucket>();
    const get = (s: Sector): Bucket => {
      let b = buckets.get(s);
      if (!b) {
        b = { pw: 0, bw: 0, pr: 0, br: 0 };
        buckets.set(s, b);
      }
      return b;
    };
    dataset.constituents.forEach((c, i) => {
      const b = get(c.sector);
      const w = c.indexWeight / 100;
      b.bw += w;
      b.br += w * stockReturn(i);
    });
    dataset.holdings.forEach((h, k) => {
      const b = get(h.sector);
      const w = (holdingValue[k] ?? 0) / equity;
      b.pw += w;
      b.pr += w * stockReturn(h.constituentIndex);
    });

    let benchmarkTotal = 0;
    let portfolioTotal = 0;
    for (const b of buckets.values()) {
      benchmarkTotal += b.br;
      portfolioTotal += b.pr;
    }

    const rows = [...buckets.entries()].map(([sector, b]) => {
      const rb = b.bw === 0 ? 0 : b.br / b.bw;
      const rp = b.pw === 0 ? rb : b.pr / b.pw;
      const allocation = (b.pw - b.bw) * (rb - benchmarkTotal);
      const selection = b.pw * (rp - rb);
      return {
        sector,
        portfolioWeightPct: round(b.pw * 100, 4),
        benchmarkWeightPct: round(b.bw * 100, 4),
        portfolioReturnPct: round(rp * 100, 4),
        benchmarkReturnPct: round(rb * 100, 4),
        allocationPct: round(allocation * 100, 4),
        selectionPct: round(selection * 100, 4),
        totalPct: round((allocation + selection) * 100, 4),
      };
    });
    rows.sort((a, b) => b.totalPct - a.totalPct);

    return {
      period,
      startDate: dataset.dates[startIndex] ?? dataset.asOfDate,
      endDate: dataset.dates[lastIndex] ?? dataset.asOfDate,
      portfolioReturnPct: round(portfolioTotal * 100, 4),
      benchmarkReturnPct: round(benchmarkTotal * 100, 4),
      rows,
    };
  });

  return { asOf: asOfIso(ctx), simulated: true, periods, methodology: ATTRIBUTION_METHODOLOGY };
}
