import { describe, expect, it } from 'vitest';
import {
  annualisedVolatility,
  brinsonAttribution,
  correlation,
  correlationMatrix,
  cumulativeReturn,
  historicalVaR,
  inverseNormalCdf,
  logReturns,
  maxDrawdown,
  parametricVaR,
  sharpeRatio,
  simpleReturns,
  valueAtRisk,
  type BrinsonSegment,
} from '@/utils/finance';

/**
 * Known-answer tests: every expected value below was worked out independently of this code
 * (by hand, or with Python's statistics / NormalDist), not by running the function under test.
 */

describe('returns', () => {
  it('simple returns: 100 -> 110 -> 99 is +10% then -10%', () => {
    const [a, b] = simpleReturns([100, 110, 99]);
    expect(a).toBeCloseTo(0.1, 12);
    expect(b).toBeCloseTo(-0.1, 12);
  });

  it('log returns: ln(110/100) = 0.0953102, ln(99/110) = -0.1053605', () => {
    const [a, b] = logReturns([100, 110, 99]);
    expect(a).toBeCloseTo(0.0953102, 7);
    expect(b).toBeCloseTo(-0.1053605, 7);
  });

  it('cumulative return compounds: +10% then -10% is -1%', () => {
    expect(cumulativeReturn([0.1, -0.1])).toBeCloseTo(-0.01, 12);
    expect(cumulativeReturn([])).toBe(0);
  });

  it('skips non-positive levels in log returns instead of producing NaN', () => {
    expect(logReturns([100, 0, 50])).toEqual([]);
  });
});

describe('volatility', () => {
  it('annualised volatility of ±1% alternating days is 0.0115470 x sqrt(252) = 18.3303%', () => {
    expect(annualisedVolatility([0.01, -0.01, 0.01, -0.01])).toBeCloseTo(0.183303, 6);
  });

  it('is 0 for a constant return series', () => {
    expect(annualisedVolatility([0.002, 0.002, 0.002])).toBe(0);
  });
});

describe('Sharpe ratio', () => {
  it('(mean 1.5% x 252 - 5%) / (stdev x sqrt(252)) = 18.2005', () => {
    // mean 0.015 -> 3.78 annualised; sample stdev 0.0129099 -> 0.2049390 annualised.
    expect(sharpeRatio([0.02, 0, 0.01, 0.03], 0.05)).toBeCloseTo(18.2005364, 6);
  });

  it('is 0 when volatility is 0 (no division by zero)', () => {
    expect(sharpeRatio([0.01, 0.01], 0.05)).toBe(0);
  });
});

describe('maximum drawdown and recovery period', () => {
  const levels = [100, 120, 90, 60, 80, 130, 110];

  it('120 -> 60 is a 50% drawdown, recovered when 130 >= 120', () => {
    const dd = maxDrawdown(levels);
    expect(dd.depth).toBeCloseTo(0.5, 12);
    expect(dd.peakIndex).toBe(1);
    expect(dd.troughIndex).toBe(3);
    expect(dd.recoveryIndex).toBe(5);
  });

  it('counts 2 periods down, 2 periods to recover, 4 under water', () => {
    const dd = maxDrawdown(levels);
    expect(dd.declinePeriods).toBe(2);
    expect(dd.recoveryPeriods).toBe(2);
    expect(dd.underwaterPeriods).toBe(4);
  });

  it('reports no recovery period while still under water', () => {
    const dd = maxDrawdown([100, 80, 90]);
    expect(dd.depth).toBeCloseTo(0.2, 12);
    expect(dd.recoveryPeriods).toBeNull();
    expect(dd.underwaterPeriods).toBeNull();
  });

  it('is 0 for a series that only rises', () => {
    expect(maxDrawdown([1, 2, 3]).depth).toBe(0);
  });
});

describe('Value at Risk', () => {
  // -10%, -9%, …, +9%: twenty equally spaced daily returns.
  const ladder = Array.from({ length: 20 }, (_, i) => (i - 10) / 100);

  it('historical VaR 95% interpolates the 5th percentile: 9.05%', () => {
    // Position (n - 1) x 0.05 = 0.95 between -10% and -9%.
    expect(historicalVaR(ladder, 0.95)).toBeCloseTo(0.0905, 10);
  });

  it('historical VaR 99%: position 0.19 gives 9.81%', () => {
    expect(historicalVaR(ladder, 0.99)).toBeCloseTo(0.0981, 10);
  });

  it('parametric VaR 95% = 1.644854 x sigma - mu = 3.65235%', () => {
    // [+3%, -1%]: mean 1%, sample stdev 2.828427%.
    expect(parametricVaR([0.03, -0.01], 0.95)).toBeCloseTo(0.0365235, 6);
  });

  it('parametric VaR 99% = 2.326348 x sigma - mu = 5.57991%', () => {
    expect(parametricVaR([0.03, -0.01], 0.99)).toBeCloseTo(0.0557991, 6);
  });

  it('uses the standard normal quantiles 1.644854, 1.959964 and 2.326348', () => {
    expect(inverseNormalCdf(0.95)).toBeCloseTo(1.644854, 6);
    expect(inverseNormalCdf(0.975)).toBeCloseTo(1.959964, 6);
    expect(inverseNormalCdf(0.99)).toBeCloseTo(2.326348, 6);
  });

  it('valueAtRisk reports both methods at 95% and 99%, 99% never below 95%', () => {
    const table = valueAtRisk(ladder);
    expect(table.historical.var95).toBeCloseTo(0.0905, 10);
    expect(table.historical.var99).toBeCloseTo(0.0981, 10);
    expect(table.parametric.var95).toBeCloseTo(parametricVaR(ladder, 0.95), 12);
    expect(table.parametric.var99).toBeGreaterThan(table.parametric.var95);
  });
});

describe('correlation', () => {
  it('[1,2,3,4] vs [1,3,2,4] has correlation 4 / 5 = 0.8', () => {
    expect(correlation([1, 2, 3, 4], [1, 3, 2, 4])).toBeCloseTo(0.8, 12);
  });

  it('is exactly +1 / -1 for linear relationships and 0 for a flat series', () => {
    expect(correlation([1, 2, 3], [2, 4, 6])).toBe(1);
    expect(correlation([1, 2, 3], [3, 2, 1])).toBe(-1);
    expect(correlation([1, 2, 3], [5, 5, 5])).toBe(0);
  });

  it('builds a symmetric matrix with a unit diagonal', () => {
    const m = correlationMatrix([
      [1, 2, 3, 4],
      [1, 3, 2, 4],
      [4, 3, 2, 1],
    ]);
    expect(m).toHaveLength(3);
    expect(m.map((row, i) => row[i])).toEqual([1, 1, 1]);
    expect(m[0]?.[1]).toBeCloseTo(0.8, 12);
    expect(m[1]?.[0]).toBe(m[0]?.[1]);
    expect(m[0]?.[2]).toBe(-1);
    expect(m[1]?.[2]).toBeCloseTo(-0.8, 12);
  });
});

describe('Brinson attribution', () => {
  // Two sectors. Portfolio 60/40 vs benchmark 50/50.
  // Rp = 0.6 x 10% + 0.4 x 2% = 6.8%; Rb = 0.5 x 8% + 0.5 x 4% = 6.0%; active = 0.8%.
  const segments: BrinsonSegment[] = [
    {
      key: 'A',
      portfolioWeight: 0.6,
      benchmarkWeight: 0.5,
      portfolioReturn: 0.1,
      benchmarkReturn: 0.08,
    },
    {
      key: 'B',
      portfolioWeight: 0.4,
      benchmarkWeight: 0.5,
      portfolioReturn: 0.02,
      benchmarkReturn: 0.04,
    },
  ];

  it('Brinson-Fachler: allocation 0.4%, selection 0%, interaction 0.4%', () => {
    const r = brinsonAttribution(segments);
    expect(r.portfolioReturn).toBeCloseTo(0.068, 12);
    expect(r.benchmarkReturn).toBeCloseTo(0.06, 12);
    // A: +0.1 x (8% - 6%) = +0.2%;  B: -0.1 x (4% - 6%) = +0.2%
    expect(r.segments[0]?.allocation).toBeCloseTo(0.002, 12);
    expect(r.segments[1]?.allocation).toBeCloseTo(0.002, 12);
    // A: 0.5 x (10% - 8%) = +1%;  B: 0.5 x (2% - 4%) = -1%
    expect(r.segments[0]?.selection).toBeCloseTo(0.01, 12);
    expect(r.segments[1]?.selection).toBeCloseTo(-0.01, 12);
    // A: 0.1 x 2% = +0.2%;  B: -0.1 x -2% = +0.2%
    expect(r.interaction).toBeCloseTo(0.004, 12);
    expect(r.allocation).toBeCloseTo(0.004, 12);
    expect(r.selection).toBeCloseTo(0, 12);
  });

  it('the three effects add up to the active return (0.8%)', () => {
    const r = brinsonAttribution(segments);
    expect(r.activeReturn).toBeCloseTo(0.008, 12);
    expect(r.total).toBeCloseTo(r.activeReturn, 12);
  });

  it('Brinson-Hood-Beebower splits allocation per sector differently but totals the same', () => {
    const r = brinsonAttribution(segments, 'BHB');
    // A: +0.1 x 8% = +0.8%;  B: -0.1 x 4% = -0.4%
    expect(r.segments[0]?.allocation).toBeCloseTo(0.008, 12);
    expect(r.segments[1]?.allocation).toBeCloseTo(-0.004, 12);
    expect(r.allocation).toBeCloseTo(0.004, 12);
    expect(r.total).toBeCloseTo(0.008, 12);
  });
});
