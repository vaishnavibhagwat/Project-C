import { describe, expect, it } from 'vitest';
import { AUM_USD, buildDataset, RISK_FREE_RATE } from '@/data/dataset';
import { NIFTY50 } from '@/data/nifty50';
import { createRng, hashSeed, normal } from '@/data/random';
import { maxDrawdown, sharpeRatio } from '@/utils/finance';
import { isTradingDay } from '@/utils/time';

const AS_OF = '2026-10-19';
const SEEDS = [20240615, 1, 42, 777, 9001];

describe('shared seeded dataset', () => {
  const ds = buildDataset(20240615, AS_OF, 83.5);

  it('is deterministic for the same seed and date', () => {
    const again = buildDataset(20240615, AS_OF, 83.5);
    expect(again.fundNav).toEqual(ds.fundNav);
    expect(again.holdings).toEqual(ds.holdings);
    expect(buildDataset(1, AS_OF, 83.5).fundNav).not.toEqual(ds.fundNav);
  });

  it('values AUM at exactly USD 45.0B at the last close', () => {
    expect(ds.aumUsd).toBe(45_000_000_000);
    expect(AUM_USD).toBe(45_000_000_000);
    const total = ds.assetClasses.reduce((s, a) => s + a.valueInr, 0);
    expect(total).toBeCloseTo(ds.aumInr, 0);
    expect(ds.aumInr / ds.fxUsdInr).toBeCloseTo(45e9, 0);
  });

  it('has allocations that sum to 100%', () => {
    const weights = ds.assetClasses.reduce((s, a) => s + a.weightPct, 0);
    expect(weights).toBeCloseTo(100, 8);
    for (const a of ds.assetClasses) expect(a.valueInr).toBeGreaterThan(0);
  });

  it('holds Nifty 50 constituents only, with positive quantities', () => {
    const symbols = new Set(NIFTY50.map((c) => c.symbol));
    expect(NIFTY50).toHaveLength(50);
    expect(ds.holdings.length).toBeGreaterThan(30);
    for (const h of ds.holdings) {
      expect(symbols.has(h.symbol)).toBe(true);
      expect(h.quantity).toBeGreaterThan(0);
    }
  });

  it('uses trading days only, ending at the as-of date', () => {
    expect(ds.dates[ds.dates.length - 1]).toBe(AS_OF);
    expect(ds.dates.every(isTradingDay)).toBe(true);
  });

  it('keeps every stock price positive and finite (GBM)', () => {
    const all = ds.stockCloses.flat();
    expect(all.length).toBe(50 * ds.dates.length);
    expect(all.every((p) => Number.isFinite(p) && p > 0)).toBe(true);
  });

  it.each(SEEDS)('seed %i: daily NAV moves stay within 0.1%%-2%%', (seed) => {
    const d = buildDataset(seed, AS_OF, 83.5);
    const outside = d.fundReturns.filter(
      (r) => Math.abs(r) < 0.001 - 1e-12 || Math.abs(r) > 0.02 + 1e-12,
    );
    expect(outside).toEqual([]);
  });

  it.each(SEEDS)('seed %i: Sharpe is in 0.3-2.5 and one 30-40%% drawdown exists', (seed) => {
    const d = buildDataset(seed, AS_OF, 83.5);
    const sharpe = sharpeRatio(d.fundReturns, d.riskFreeRate);
    expect(sharpe).toBeGreaterThanOrEqual(0.3);
    expect(sharpe).toBeLessThanOrEqual(2.5);
    const dd = maxDrawdown(d.fundNav);
    expect(dd.depth).toBeGreaterThanOrEqual(0.3);
    expect(dd.depth).toBeLessThanOrEqual(0.4);
  });

  it('uses a risk-free rate between 6.5% and 7%', () => {
    expect(RISK_FREE_RATE).toBeGreaterThanOrEqual(0.065);
    expect(RISK_FREE_RATE).toBeLessThanOrEqual(0.07);
  });
});

describe('seeded random helpers', () => {
  it('repeat for the same seed', () => {
    const a = createRng(hashSeed('x', 1));
    const b = createRng(hashSeed('x', 1));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produce roughly standard normal draws', () => {
    const rng = createRng(7);
    const draws = Array.from({ length: 20_000 }, () => normal(rng));
    const m = draws.reduce((s, v) => s + v, 0) / draws.length;
    const v = draws.reduce((s, x) => s + (x - m) ** 2, 0) / draws.length;
    expect(Math.abs(m)).toBeLessThan(0.03);
    expect(v).toBeGreaterThan(0.95);
    expect(v).toBeLessThan(1.05);
  });
});
