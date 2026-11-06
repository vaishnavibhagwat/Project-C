import { describe, expect, it } from 'vitest';
import { approxDuration } from '@/data/derive/riskExtra';
import { fixture } from './fixtures';

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe('risk/exposure', () => {
  const data = fixture('risk/exposure');

  it('lists every position; market values add up to the book', () => {
    expect(data.positions).toHaveLength(62);
    expect(sum(data.positions.map((p) => p.marketValueInr))).toBeCloseTo(
      data.totalMarketValueInr,
      0,
    );
  });

  it('carries futures at full notional (far above their margin value)', () => {
    const fut = data.positions.find((p) => p.instrumentType === 'Index Future');
    expect(fut).toBeDefined();
    if (fut) expect(Math.abs(fut.exposureInr)).toBeGreaterThan(Math.abs(fut.marketValueInr) * 3);
  });
});

describe('risk/stress', () => {
  const data = fixture('risk/stress');
  const byId = (id: string) => data.scenarios.find((s) => s.id === id);

  it('has the four scenarios with sensible signs and sizes', () => {
    expect(data.scenarios.map((s) => s.id)).toEqual([
      'nifty-10',
      'rates-100',
      'inr-5',
      'covid-2020',
    ]);
    const nifty = byId('nifty-10');
    const rates = byId('rates-100');
    const inr = byId('inr-5');
    const covid = byId('covid-2020');
    // About two-thirds of the book is equity with betas near 1: a 10% fall costs 4–9%.
    expect(nifty?.impactPct).toBeLessThan(-4);
    expect(nifty?.impactPct).toBeGreaterThan(-9);
    expect(rates?.impactPct).toBeLessThan(0);
    expect(rates?.impactPct).toBeGreaterThan(-3);
    expect(inr?.impactPct).toBeGreaterThan(0);
    expect(covid?.impactPct).toBeLessThan(nifty?.impactPct ?? 0);
  });

  it('adds the asset-class impacts up to the total, and % matches INR', () => {
    for (const s of data.scenarios) {
      expect(sum(s.byAssetClass.map((a) => a.impactInr))).toBeCloseTo(s.impactInr, -1);
      expect(s.impactPct).toBeCloseTo((s.impactInr / data.portfolioValueInr) * 100, 3);
      expect(s.largest.length).toBeGreaterThan(0);
    }
  });

  it('approximates bond duration from the ticker', () => {
    expect(approxDuration('T-BILL 91D', 'Treasury Bill', 2026)).toBe(0.25);
    const d = approxDuration('GOI 7.18% 2033', 'Government Bond', 2026);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(6);
  });
});

describe('risk/contributions', () => {
  const data = fixture('risk/contributions');
  const varData = fixture('risk/var');

  it('splits portfolio volatility exactly across positions', () => {
    expect(data.lookbackDays).toBe(252);
    expect(sum(data.positions.map((p) => p.contributionInr))).toBeCloseTo(
      data.portfolioSigmaInr,
      -2,
    );
    // Some positions diversify (negative contribution) or are near zero (cash).
    expect(data.positions.some((p) => p.contributionInr <= 0)).toBe(true);
  });

  it('implies a parametric 99% VaR close to the risk/var endpoint', () => {
    const implied = (2.326 * data.portfolioSigmaInr) / data.portfolioValueInr;
    expect(implied).toBeGreaterThan(varData.parametric.var99 * 0.85);
    expect(implied).toBeLessThan(varData.parametric.var99 * 1.15);
  });
});

describe('portfolio/holding-history', () => {
  it('has 60 closes for every holding, keyed like portfolio/holdings', () => {
    const data = fixture('portfolio/holding-history');
    const holdings = fixture('portfolio/holdings');
    expect(data.dates).toHaveLength(60);
    expect(data.holdings.map((h) => h.holdingId).sort()).toEqual(
      holdings.holdings.map((h) => h.holdingId).sort(),
    );
  });
});
