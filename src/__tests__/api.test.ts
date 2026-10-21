import { describe, expect, it } from 'vitest';
import {
  ConnectionError,
  ENDPOINT_IDS,
  ENDPOINTS,
  fetchEndpoint,
  isEndpointData,
  parseEndpoint,
  setSimulatedOutage,
  ValidationError,
} from '@/data';
import { getMarketSnapshot, primeMarket, resetMarketSimulation } from '@/data/market';
import { buildDataset } from '@/data/dataset';
import { createTradeSchedule } from '@/data/derive/trades';
import { istTimeMs } from '@/utils/time';
import { fixture, FIXTURE_TIME } from './fixtures';

describe('mock API', () => {
  it.each(ENDPOINT_IDS)('%s returns a schema-valid, simulated response', async (endpoint) => {
    const data = await fetchEndpoint(endpoint, {
      latencyMs: 0,
      errorRate: 0,
      now: () => FIXTURE_TIME,
    });
    expect(ENDPOINTS[endpoint].schema.safeParse(data).success).toBe(true);
    expect(data.simulated).toBe(true);
    expect(data.asOf).toMatch(/\+05:30$/);
    expect(isEndpointData(endpoint)(data)).toBe(true);
  });

  it('rejects NaN, Infinity and negative prices', () => {
    const good = fixture('portfolio/holdings');
    const first = good.holdings[0];
    if (!first) throw new Error('fixture has no holdings');
    const bad = (patch: Record<string, unknown>) => ({
      ...good,
      holdings: [{ ...first, ...patch }, ...good.holdings.slice(1)],
    });
    expect(() => parseEndpoint('portfolio/holdings', bad({ ltp: -1 }))).toThrow(ValidationError);
    expect(() => parseEndpoint('portfolio/holdings', bad({ ltp: Number.NaN }))).toThrow(
      ValidationError,
    );
    expect(() => parseEndpoint('portfolio/holdings', bad({ marketValueInr: Infinity }))).toThrow(
      ValidationError,
    );
  });

  it('rejects allocations that do not sum to 100%', () => {
    const good = fixture('portfolio/allocation');
    const broken = {
      ...good,
      assetClasses: good.assetClasses.map((a) => ({ ...a, weightPct: a.weightPct * 0.9 })),
    };
    expect(() => parseEndpoint('portfolio/allocation', broken)).toThrow(/sum to 100/);
  });

  it('only trusts objects that passed validation', () => {
    const copy: unknown = JSON.parse(JSON.stringify(fixture('risk/var')));
    expect(isEndpointData('risk/var')(copy)).toBe(false);
    expect(isEndpointData('risk/metrics')(fixture('risk/var'))).toBe(false);
  });

  it('fails with ConnectionError while the feed is disconnected', async () => {
    setSimulatedOutage(true);
    await expect(fetchEndpoint('risk/var', { latencyMs: 0 })).rejects.toBeInstanceOf(
      ConnectionError,
    );
    setSimulatedOutage(false);
  });

  it('injects upstream failures at the configured error rate', async () => {
    await expect(fetchEndpoint('risk/var', { latencyMs: 0, errorRate: 1 })).rejects.toThrow(/503/);
  });

  it('honours abort signals during simulated latency', async () => {
    const controller = new AbortController();
    const pending = fetchEndpoint('risk/var', { latencyMs: 1000, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow(/aborted/);
  });
});

describe('one dataset, consistent everywhere', () => {
  const summary = fixture('portfolio/summary');
  const holdings = fixture('portfolio/holdings');
  const allocation = fixture('portfolio/allocation');
  const risk = fixture('risk/var');
  const alerts = fixture('alerts/active');

  it('equity value agrees between holdings and allocation', () => {
    const equity = allocation.assetClasses.find((a) => a.id === 'equity');
    expect(equity?.valueInr).toBeCloseTo(holdings.totalMarketValueInr, 0);
    expect(allocation.totalInr).toBeCloseTo(summary.marketValueInr, 0);
  });

  it('day P&L in the summary equals the sum over holdings', () => {
    const sum = holdings.holdings.reduce((s, h) => s + h.dayPnlInr, 0);
    expect(summary.dayPnlInr).toBeCloseTo(sum, -2);
  });

  it('holding weights and sector weights each sum to 100%', () => {
    expect(holdings.holdings.reduce((s, h) => s + h.weightPct, 0)).toBeCloseTo(100, 6);
    expect(allocation.sectors.reduce((s, x) => s + x.weightPct, 0)).toBeCloseTo(100, 6);
  });

  it('the VaR alert quotes the same number as the VaR endpoint', () => {
    const varAlert = alerts.alerts.find((a) => a.id === 'risk-var99');
    if (risk.historical.var99 >= 0.015) {
      expect(varAlert?.title).toContain(`${(risk.historical.var99 * 100).toFixed(2)}%`);
    } else {
      expect(varAlert).toBeUndefined();
    }
  });

  it('VaR uses a 252-day lookback and reports both methods', () => {
    expect(risk.lookbackDays).toBe(252);
    expect(risk.historical.var99).toBeGreaterThan(risk.historical.var95);
    expect(risk.parametric.var99).toBeGreaterThan(risk.parametric.var95);
    expect(risk.assumptions.length).toBeGreaterThan(2);
  });

  it('attribution effects add up to the active return', () => {
    for (const p of fixture('performance/attribution').periods) {
      const total = p.rows.reduce((s, r) => s + r.totalPct, 0);
      expect(total).toBeCloseTo(p.portfolioReturnPct - p.benchmarkReturnPct, 2);
    }
  });

  it('labels research as sample content', () => {
    expect(fixture('research/feed').disclaimer).toMatch(/sample/i);
  });
});

describe('trades and the intraday tape', () => {
  it('settles every trade T+1 and prints fills inside NSE hours', () => {
    const { trades, tradeDate } = fixture('trades/blotter');
    expect(trades.length).toBeGreaterThan(0);
    for (const t of trades) {
      const hhmm = t.time.slice(11, 16);
      expect(hhmm >= '09:15' && hhmm < '15:30').toBe(true);
      if (t.tradeDate === tradeDate) expect(t.settlementDate).toBe('2026-10-21');
      expect(t.settlementDate > t.tradeDate).toBe(true);
    }
  });

  it('produces the same prices for the same time on every call', () => {
    const ds = buildDataset(20240615, '2026-10-19', 83.5);
    const now = istTimeMs('2026-10-20', 13, 0);
    const a = getMarketSnapshot(ds, now, createTradeSchedule(ds), 5000, true).prices;
    const later = getMarketSnapshot(ds, now + 60_000, createTradeSchedule(ds), 5000, true).prices;
    const b = getMarketSnapshot(ds, now, createTradeSchedule(ds), 5000, true).prices;
    expect(b).toEqual(a);
    expect(later).not.toEqual(a);
  });

  it('primes a full day of ticks in slices with identical results', async () => {
    const ds = buildDataset(20240615, '2026-10-20', 83.5);
    const now = istTimeMs('2026-10-21', 23, 0);
    resetMarketSimulation();
    const direct = getMarketSnapshot(ds, now, createTradeSchedule(ds), 5000, true).prices;
    resetMarketSimulation();
    const partial = getMarketSnapshot(ds, now, createTradeSchedule(ds), 5000, true, 100);
    expect(partial.caughtUp).toBe(false);
    await primeMarket(ds, now, createTradeSchedule(ds), 5000, true);
    const primed = getMarketSnapshot(ds, now, createTradeSchedule(ds), 5000, true);
    expect(primed.caughtUp).toBe(true);
    expect(primed.prices).toEqual(direct);
  });

  it('freezes prices at the last close outside hours when simulation is off', () => {
    const ds = buildDataset(20240615, '2026-10-19', 83.5);
    const snap = getMarketSnapshot(
      ds,
      istTimeMs('2026-10-18', 12, 0),
      createTradeSchedule(ds),
      5000,
      false,
    );
    expect(snap.mode).toBe('frozen');
    expect(snap.tick).toBe(0);
    expect(snap.prices).toEqual(snap.referenceCloses.map((c) => Math.round(c * 100) / 100));
  });
});
