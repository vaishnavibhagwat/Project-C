import { describe, expect, it } from 'vitest';
import { AUM_USD, RISK_FREE_RATE } from '@/data/dataset';
import { buildPortfolioModel, closeValueInr } from '@/data/model';
import { NIFTY50 } from '@/data/nifty50';
import { createRng, hashSeed, normal } from '@/data/random';
import { maxDrawdown, sharpeRatio } from '@/utils/finance';
import { isTradingDay } from '@/utils/time';

const AS_OF = '2026-10-19';
const SEEDS = [20240615, 1, 42, 777, 9001];

describe('portfolio model (src/data/model.ts)', () => {
  const ds = buildPortfolioModel(20240615, AS_OF, 83.5);
  const fx = ds.fxUsdInr;

  it('is deterministic for the same seed and date', () => {
    const again = buildPortfolioModel(20240615, AS_OF, 83.5);
    expect(again.fundNav).toEqual(ds.fundNav);
    expect(again.positions).toEqual(ds.positions);
    expect(buildPortfolioModel(1, AS_OF, 83.5).fundNav).not.toEqual(ds.fundNav);
  });

  it('values the book at exactly USD 45.0B at the last close (within one rupee)', () => {
    expect(ds.aumUsd).toBe(45_000_000_000);
    expect(AUM_USD).toBe(45_000_000_000);
    const total = ds.positions.reduce((s, p) => s + closeValueInr(p, fx), 0);
    expect(Math.abs(total - ds.aumInr)).toBeLessThan(1);
    expect(ds.aumInr / fx).toBeCloseTo(45e9, 0);
    expect(ds.bookValue[ds.bookValue.length - 1]).toBeCloseTo(total, 2);
  });

  it('has position weights and asset-class weights that sum to 100%', () => {
    const total = ds.positions.reduce((s, p) => s + closeValueInr(p, fx), 0);
    const weights = ds.positions.map((p) => (closeValueInr(p, fx) / total) * 100);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 8);
    const classes = ['Equity', 'Fixed Income', 'Derivatives', 'Alternatives'].map((c) =>
      ds.positions
        .filter((p) => p.assetClass === c)
        .reduce((s, p) => s + (closeValueInr(p, fx) / total) * 100, 0),
    );
    expect(classes.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 8);
    for (const w of classes) expect(w).toBeGreaterThan(0);
  });

  it('holds Nifty 50 constituents in its equity sleeve, with positive quantities', () => {
    const symbols = new Set(NIFTY50.map((c) => c.symbol));
    expect(NIFTY50).toHaveLength(50);
    expect(ds.holdings.length).toBe(42);
    for (const h of ds.holdings) expect(symbols.has(h.symbol)).toBe(true);
    for (const p of ds.positions) expect(p.quantity).toBeGreaterThan(0);
  });

  it('derives NAV from the holdings: each daily change is the book P&L', () => {
    // Recompute day t's P&L from positions and prices, independently of bookValueSeries.
    for (const t of [1, 300, ds.crash.troughIndex, ds.dates.length - 1]) {
      const pnl = ds.positions.reduce((s, p) => {
        const k = p.quantity * (p.currency === 'USD' ? fx : 1);
        return s + k * ((p.closes[t] ?? 0) - (p.closes[t - 1] ?? 0));
      }, 0);
      const navChange = (ds.fundNav[t] ?? 0) / (ds.fundNav[t - 1] ?? 1) - 1;
      expect(navChange).toBeCloseTo(pnl / (ds.bookValue[t - 1] ?? 1), 12);
    }
  });

  it('uses trading days only, ending at the as-of date', () => {
    expect(ds.dates[ds.dates.length - 1]).toBe(AS_OF);
    expect(ds.dates.every(isTradingDay)).toBe(true);
    for (const p of ds.positions) expect(p.closes).toHaveLength(ds.dates.length);
  });

  it('keeps every price positive and finite (GBM)', () => {
    const all = [...ds.stockCloses.flat(), ...ds.positions.flatMap((p) => p.closes)];
    expect(all.every((p) => Number.isFinite(p) && p > 0)).toBe(true);
  });

  it.each(SEEDS)('seed %i: daily NAV moves are mostly 0.1%%-2%% and never beyond 5%%', (seed) => {
    const d = buildPortfolioModel(seed, AS_OF, 83.5);
    const inside = d.fundReturns.filter((r) => Math.abs(r) >= 0.001 && Math.abs(r) <= 0.02);
    expect(inside.length / d.fundReturns.length).toBeGreaterThan(0.85);
    expect(Math.max(...d.fundReturns.map(Math.abs))).toBeLessThan(0.05);
  });

  it.each(SEEDS)('seed %i: Sharpe is in 0.3-2.5 and one 30-40%% drawdown exists', (seed) => {
    const d = buildPortfolioModel(seed, AS_OF, 83.5);
    const sharpe = sharpeRatio(d.fundReturns, d.riskFreeRate);
    expect(sharpe).toBeGreaterThanOrEqual(0.3);
    expect(sharpe).toBeLessThanOrEqual(2.5);
    const dd = maxDrawdown(d.fundNav);
    expect(dd.depth).toBeGreaterThanOrEqual(0.3);
    expect(dd.depth).toBeLessThanOrEqual(0.4);
    expect(dd.recoveryIndex).not.toBeNull();
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
