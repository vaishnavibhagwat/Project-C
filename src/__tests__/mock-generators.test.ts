import { describe, expect, it } from 'vitest';
import { buildDataset, getDataset } from '@/data/dataset';
import {
  ASSET_CLASSES,
  BENCHMARK_IDS,
  benchmarkReturns,
  blackScholes,
  GEOGRAPHIES,
  gbmPath,
  holdingsResponse,
  mockWorld,
  NEWS_SOURCES,
  newsResponse,
  normalCdf,
  performanceResponse,
  poisson,
  portfolioResponse,
  rollingVolatility,
  valueInr,
  WINDOW_DAYS,
} from '@/data/mock';
import { createRng } from '@/data/random';
import { mean, stdev } from '@/utils/finance';
import { FIXTURE_TIME } from './fixtures';

const dataset = getDataset(FIXTURE_TIME);
const world = mockWorld(dataset);
const fx = dataset.fxUsdInr;

function correlation(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let acc = 0;
  for (let i = 0; i < n; i += 1) acc += ((a[i] ?? 0) - ma) * ((b[i] ?? 0) - mb);
  return acc / (n - 1) / (stdev(a.slice(0, n)) * stdev(b.slice(0, n)));
}

describe('GBM and pricing helpers', () => {
  it('gbmPath stays positive, ends at the anchor and has the requested volatility', () => {
    // 1,000 simulated years, so the drift estimate is within about ±0.02 a year.
    const path = gbmPath(createRng(7), 252_000, { drift: 0.08, volatility: 0.2, endPrice: 150 });
    expect(path).toHaveLength(252_001);
    expect(path.every((p) => p > 0 && Number.isFinite(p))).toBe(true);
    expect(path[path.length - 1]).toBeCloseTo(150, 8);
    const logReturns = path.slice(1).map((p, t) => Math.log(p / (path[t] ?? p)));
    expect(stdev(logReturns) * Math.sqrt(252)).toBeCloseTo(0.2, 2);
    // Log drift is mu − σ²/2 per year.
    expect(Math.abs(mean(logReturns) * 252 - (0.08 - 0.02))).toBeLessThan(0.03);
  });

  it('normalCdf and Black–Scholes match known values and put–call parity', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    const base = { spot: 100, strike: 100, years: 1, rate: 0.05, volatility: 0.2 };
    const call = blackScholes({ kind: 'call', ...base });
    const put = blackScholes({ kind: 'put', ...base });
    expect(call.price).toBeCloseTo(10.4506, 3);
    expect(call.price - put.price).toBeCloseTo(100 - 100 * Math.exp(-0.05), 6);
    expect(call.delta - put.delta).toBeCloseTo(1, 9);
  });

  it('poisson has the right mean; rolling volatility has no NaN', () => {
    const rng = createRng(3);
    const draws = Array.from({ length: 20_000 }, () => poisson(rng, 2.5));
    expect(mean(draws)).toBeCloseTo(2.5, 1);
    expect(poisson(rng, 0)).toBe(0);
    const vol = rollingVolatility([0.01, -0.02, 0.015, 0], 20);
    expect(vol[0]).toBe(0);
    expect(vol.every(Number.isFinite)).toBe(true);
  });
});

describe('portfolio book', () => {
  const book = world.instruments;
  const holdings = holdingsResponse(world).holdings;

  it('holds about 40 Nifty 50 stocks plus USD ADR/GDR receipts', () => {
    const stocks = book.filter((i) => i.instrumentType === 'Stock');
    expect(stocks.length).toBeGreaterThanOrEqual(38);
    expect(stocks.length).toBeLessThanOrEqual(45);
    expect(new Set(stocks.map((s) => s.sector)).size).toBeGreaterThanOrEqual(10);
    const receipts = book.filter((i) => i.instrumentType === 'ADR' || i.instrumentType === 'GDR');
    expect(receipts.length).toBeGreaterThanOrEqual(4);
    expect(receipts.every((r) => r.currency === 'USD' && r.assetClass === 'Equity')).toBe(true);
  });

  it('covers every asset class and geography and adds up to the fund AUM', () => {
    expect(new Set(book.map((i) => i.assetClass))).toEqual(new Set(ASSET_CLASSES));
    expect(new Set(book.map((i) => i.geography))).toEqual(new Set(GEOGRAPHIES));
    const total = book.reduce((s, i) => s + valueInr(i, fx), 0);
    expect(Math.abs(total / dataset.aumInr - 1)).toBeLessThan(1e-4);
    const summary = portfolioResponse(world);
    const equity = summary.assetClasses.find((a) => a.key === 'Equity')?.weightPct ?? 0;
    expect(equity).toBeGreaterThan(55);
    expect(equity).toBeLessThan(75);
    expect(summary.aumUsd / 1e9).toBeCloseTo(45, 1);
  });

  it('prices every holding with finite, positive numbers', () => {
    for (const h of holdings) {
      for (const v of [h.price, h.previousClose, h.priceInr, h.averageCost]) {
        expect(Number.isFinite(v) && v > 0, `${h.ticker}`).toBe(true);
      }
      expect(Number.isFinite(h.marketValueInr) && h.marketValueInr >= 0).toBe(true);
    }
  });

  it('prices ADRs from their underlying at the USD/INR rate (with a small premium)', () => {
    const adr = book.find((i) => i.id === 'adr-hdb');
    const underlying = book.find((i) => i.ticker === 'HDFCBANK');
    const ratio = ((adr?.closes.at(-1) ?? 0) * fx) / ((underlying?.closes.at(-1) ?? 1) * 3);
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(1.12);
  });

  it('carries futures at margin but reports their full notional exposure', () => {
    const fut = book.find((i) => i.instrumentType === 'Index Future');
    const h = holdings.find((x) => x.instrumentType === 'Index Future');
    expect(fut && h).toBeTruthy();
    expect((h?.exposureInr ?? 0) / (h?.marketValueInr ?? 1)).toBeCloseTo(1 / 0.12, 6);
    const put = holdings.find((x) => x.ticker.endsWith('PE'));
    expect(put?.exposureInr).toBeLessThan(0); // a put is short delta
  });
});

describe('NAV and benchmarks', () => {
  const perf = performanceResponse(world);

  it('has three years of daily NAV with one ~35% drawdown that recovers', () => {
    expect(perf.dates).toHaveLength(WINDOW_DAYS + 1);
    expect(perf.nav).toHaveLength(WINDOW_DAYS + 1);
    expect(perf.maxDrawdown.depthPct).toBeGreaterThan(30);
    expect(perf.maxDrawdown.depthPct).toBeLessThan(40);
    expect(perf.maxDrawdown.recoveryDate).not.toBeNull();
    expect(perf.maxDrawdown.troughDate > perf.maxDrawdown.peakDate).toBe(true);
    expect((perf.maxDrawdown.recoveryDate ?? '') > perf.maxDrawdown.troughDate).toBe(true);
    expect(Math.min(...perf.drawdownPct)).toBeCloseTo(-perf.maxDrawdown.depthPct, 3);
  });

  it('has six positive benchmark series aligned with the NAV dates', () => {
    expect(perf.benchmarks.map((b) => b.id)).toEqual([...BENCHMARK_IDS]);
    for (const b of perf.benchmarks) {
      expect(b.levels).toHaveLength(perf.dates.length);
      expect(b.levels.every((l) => l > 0)).toBe(true);
    }
  });

  it('relates the benchmarks the way real indices do', () => {
    const nifty = benchmarkReturns(world, 'NIFTY50');
    expect(correlation(nifty, benchmarkReturns(world, 'SENSEX'))).toBeGreaterThan(0.95);
    expect(correlation(nifty, benchmarkReturns(world, 'NIFTYBANK'))).toBeGreaterThan(0.5);
    expect(correlation(nifty, benchmarkReturns(world, 'NIFTYIT'))).toBeGreaterThan(0.4);
    const spx = correlation(nifty, benchmarkReturns(world, 'SPX'));
    expect(spx).toBeGreaterThan(0);
    expect(spx).toBeLessThan(0.8);
  });
});

describe('news and alerts', () => {
  it('uses the four sources, and sentiment follows the price move', () => {
    const news = world.news;
    expect(news.length).toBeGreaterThan(100);
    expect(new Set(news.map((n) => n.source))).toEqual(new Set(NEWS_SOURCES));
    const r = correlation(
      news.map((n) => n.sentimentScore),
      news.map((n) => n.priceMovePct),
    );
    expect(r).toBeGreaterThan(0.5);
    const bigUp = news.filter((n) => n.priceMovePct > 2);
    const bigDown = news.filter((n) => n.priceMovePct < -2);
    const share = (xs: typeof news, s: string) =>
      xs.filter((n) => n.sentiment === s).length / xs.length;
    if (bigUp.length > 0) expect(share(bigUp, 'positive')).toBeGreaterThan(0.7);
    if (bigDown.length > 0) expect(share(bigDown, 'negative')).toBeGreaterThan(0.7);
  });

  it('never returns news published after "now"', () => {
    const latest = world.news[0];
    const cutoff = (latest?.publishedMs ?? 0) - 1;
    const articles = newsResponse(world, cutoff, 500).articles;
    expect(articles.some((a) => a.articleId === latest?.articleId)).toBe(false);
    expect(articles.every((a) => Date.parse(a.publishedAt) <= cutoff)).toBe(true);
  });

  it('fires alerts more often when volatility is high', () => {
    const returns = dataset.fundReturns.slice(dataset.fundReturns.length - WINDOW_DAYS);
    const vols = rollingVolatility(returns, 20);
    const dates = world.window.dates.slice(1);
    const perDay = new Map<string, number>();
    for (const a of world.alerts) {
      const day = a.triggeredAt.slice(0, 10);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    const days = dates.map((d, k) => ({ vol: vols[k] ?? 0, count: perDay.get(d) ?? 0 }));
    const sorted = [...days].sort((a, b) => a.vol - b.vol);
    const quarter = Math.floor(sorted.length / 4);
    const calm = mean(sorted.slice(0, quarter).map((d) => d.count));
    const stormy = mean(sorted.slice(-quarter).map((d) => d.count));
    expect(stormy).toBeGreaterThan(2.5 * Math.max(calm, 0.01));
    expect(
      correlation(
        days.map((d) => d.vol),
        days.map((d) => d.count),
      ),
    ).toBeGreaterThan(0.2);
    // Critical alerts come from turbulent days.
    const critical = world.alerts.filter((a) => a.severity === 'critical');
    const median = sorted[Math.floor(sorted.length / 2)]?.vol ?? 0;
    expect(critical.every((a) => a.volatilityPct / 100 > median)).toBe(true);
  });
});

describe('determinism', () => {
  it('rebuilds the same book, series, news and alerts from the same seed and day', () => {
    const again = mockWorld(buildDataset(dataset.seed, dataset.asOfDate, dataset.fxUsdInr));
    expect(again).not.toBe(world);
    expect(JSON.stringify(holdingsResponse(again))).toBe(JSON.stringify(holdingsResponse(world)));
    expect(again.benchmarks).toEqual(world.benchmarks);
    expect(again.news).toEqual(world.news);
    expect(again.alerts).toEqual(world.alerts);
  });

  it('changes with the seed', () => {
    const other = mockWorld(buildDataset(dataset.seed + 1, dataset.asOfDate, dataset.fxUsdInr));
    expect(other.benchmarks[2]?.levels).not.toEqual(world.benchmarks[2]?.levels);
  });
});
