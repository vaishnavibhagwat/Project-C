import type { Holding } from '@/types';
import { createRng, hashSeed } from '../random';

/**
 * A large, clearly synthetic holdings list for exercising tables (virtual scrolling, sort,
 * search, export) at 1,000+ rows. Row i copies real holding i mod n at a seeded size between
 * 0.2x and 3x, so prices and day moves stay live; ids, tickers and names are marked as
 * simulated and weights are recomputed over the generated rows. Totals do not match the book.
 */
export function generateStressHoldings(base: readonly Holding[], count: number): Holding[] {
  if (base.length === 0 || count <= 0) return [];
  const rows: Holding[] = [];
  for (let i = 0; i < count; i += 1) {
    const b = base[i % base.length];
    if (!b) continue;
    const scale = 0.2 + createRng(hashSeed('holdings-stress', i))() * 2.8;
    const quantity = Math.max(1, Math.round(b.quantity * scale));
    const k = quantity / b.quantity;
    rows.push({
      ...b,
      holdingId: `sim-${i + 1}`,
      ticker: `${b.ticker} #${i + 1}`,
      name: `${b.name} (simulated row ${i + 1})`,
      quantity,
      marketValue: b.marketValue * k,
      dailyPnL: b.dailyPnL * k,
      unrealisedPnL: b.unrealisedPnL * k,
      costBasis: b.costBasis * k,
    });
  }
  const total = rows.reduce((s, h) => s + h.marketValue, 0);
  return rows.map((h) => ({ ...h, weight: total > 0 ? (h.marketValue / total) * 100 : 0 }));
}
