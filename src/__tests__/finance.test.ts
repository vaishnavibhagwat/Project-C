import { describe, expect, it } from 'vitest';
import {
  annualisedVolatility,
  beta,
  cagr,
  drawdownSeries,
  gbmStep,
  histogram,
  historicalCVaR,
  historicalVaR,
  inverseNormalCdf,
  maxDrawdown,
  mean,
  parametricVaR,
  quantile,
  sharpeRatio,
  simpleReturns,
  sortinoRatio,
  stdev,
  trackingError,
} from '@/utils/finance';

describe('basic statistics', () => {
  it('computes mean and sample standard deviation', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(stdev([1])).toBe(0);
    expect(mean([])).toBe(0);
  });

  it('derives simple returns from levels', () => {
    const [up, down] = simpleReturns([100, 110, 99]);
    expect(up).toBeCloseTo(0.1, 10);
    expect(down).toBeCloseTo(-0.1, 10);
  });

  it('interpolates quantiles like numpy (type 7)', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75);
  });
});

describe('geometric Brownian motion', () => {
  it('is deterministic for a given shock and never goes negative', () => {
    const next = gbmStep(100, 0.1, 0.2, 1 / 252, 0);
    expect(next).toBeCloseTo(100 * Math.exp((0.1 - 0.02) / 252), 10);
    expect(gbmStep(100, 0, 0.9, 1 / 252, -8)).toBeGreaterThan(0);
  });
});

describe('risk-adjusted returns', () => {
  const daily = Array.from({ length: 252 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.006));

  it('annualises volatility with sqrt(252)', () => {
    expect(annualisedVolatility(daily)).toBeCloseTo(stdev(daily) * Math.sqrt(252), 10);
  });

  it('computes Sharpe as excess return over volatility', () => {
    const expected = (mean(daily) * 252 - 0.0675) / annualisedVolatility(daily);
    expect(sharpeRatio(daily, 0.0675)).toBeCloseTo(expected, 10);
  });

  it('gives a higher Sortino than Sharpe when downside is limited', () => {
    expect(sortinoRatio(daily, 0.0675)).toBeGreaterThan(sharpeRatio(daily, 0.0675));
  });

  it('computes CAGR over the period', () => {
    const levels = Array.from({ length: 253 }, (_, i) => 100 * 1.1 ** (i / 252));
    expect(cagr(levels)).toBeCloseTo(0.1, 6);
  });

  it('measures beta and tracking error against a benchmark', () => {
    const bench = [0.01, -0.02, 0.015, -0.005, 0.02];
    const asset = bench.map((r) => 2 * r);
    expect(beta(asset, bench)).toBeCloseTo(2, 10);
    expect(trackingError(bench, bench)).toBe(0);
  });
});

describe('drawdowns', () => {
  it('finds peak, trough and recovery', () => {
    const levels = [100, 120, 90, 60, 80, 125, 110];
    const dd = maxDrawdown(levels);
    expect(dd.depth).toBeCloseTo(0.5);
    expect(dd.peakIndex).toBe(1);
    expect(dd.troughIndex).toBe(3);
    expect(dd.recoveryIndex).toBe(5);
    expect(drawdownSeries(levels)[3]).toBeCloseTo(-0.5);
  });

  it('reports null recovery when the peak is not regained', () => {
    expect(maxDrawdown([100, 80, 90]).recoveryIndex).toBeNull();
  });
});

describe('value at risk', () => {
  const returns = Array.from({ length: 100 }, (_, i) => (i - 50) / 1000);

  it('historical VaR is the loss at the lower quantile', () => {
    expect(historicalVaR(returns, 0.95)).toBeCloseTo(-quantile(returns, 0.05), 10);
    expect(historicalVaR(returns, 0.99)).toBeGreaterThan(historicalVaR(returns, 0.95));
  });

  it('CVaR is at least as large as VaR', () => {
    expect(historicalCVaR(returns, 0.95)).toBeGreaterThanOrEqual(historicalVaR(returns, 0.95));
  });

  it('inverse normal CDF matches known z-scores', () => {
    expect(inverseNormalCdf(0.95)).toBeCloseTo(1.6449, 4);
    expect(inverseNormalCdf(0.99)).toBeCloseTo(2.3263, 4);
    expect(inverseNormalCdf(0.5)).toBeCloseTo(0, 8);
    expect(inverseNormalCdf(0.01)).toBeCloseTo(-2.3263, 4);
    expect(() => inverseNormalCdf(1)).toThrow(RangeError);
  });

  it('parametric VaR equals z * sigma - mu', () => {
    const z = inverseNormalCdf(0.99);
    expect(parametricVaR(returns, 0.99)).toBeCloseTo(z * stdev(returns) - mean(returns), 10);
  });

  it('histogram counts every observation once', () => {
    const bins = histogram(returns, 10);
    expect(bins).toHaveLength(10);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(returns.length);
  });
});
