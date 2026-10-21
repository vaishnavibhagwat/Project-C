import { env } from '@/utils/env';
import {
  getNseSession,
  istDateKey,
  istTimeMs,
  isTradingDay,
  NSE_CLOSE,
  NSE_OPEN,
} from '@/utils/time';
import { lastClose, type Dataset } from './dataset';
import { createRng, hashSeed, normal } from './random';

/**
 * Intraday price simulation. Prices evolve from the latest close by geometric Brownian motion,
 * one step per tick. Each tick draws from its own seeded generator, so the price at a given
 * time is deterministic: every widget, every tab and every reload sees the same tape.
 */

export type SessionMode = 'nse-hours' | 'extended' | 'frozen';

export interface ScheduledTrade {
  tick: number;
  constituentIndex: number;
}

/** Tick range [from, to) during which trades can print (NSE hours on a trading day only). */
export interface TradeWindow {
  from: number;
  to: number;
}

export interface MarketSnapshot {
  /** Time the current tick was printed (epoch ms). */
  asOfMs: number;
  mode: SessionMode;
  sessionKey: string;
  sessionStartMs: number;
  tickMs: number;
  tick: number;
  maxTicks: number;
  /** Live prices, indexed like dataset.constituents. */
  prices: number[];
  /** Reference closes the intraday moves are measured from. */
  referenceCloses: number[];
  /** Benchmark move since reference close, as a fraction. */
  benchmarkChange: number;
  /** Key and window the trade schedule was requested with (so fills can be looked up). */
  scheduleKey: string;
  tradeWindow: TradeWindow;
  /** Session date (IST) the tape belongs to. */
  sessionDate: string;
  /** False when the tape was advanced only part of the way (see maxSteps). */
  caughtUp: boolean;
  /** Fill prices for scheduled trades that have printed, keyed by `${tick}:${index}`. */
  fills: ReadonlyMap<string, number>;
}

interface SimState {
  key: string;
  tick: number;
  logCum: number[];
  factorCum: number;
  fills: Map<string, number>;
}

let state: SimState | null = null;

const INTRADAY_FACTOR_VOL = 0.0092;

export interface SessionClock {
  mode: SessionMode;
  sessionKey: string;
  startMs: number;
  lengthMs: number;
}

export function sessionClock(
  nowMs: number,
  simulateOutsideHours = env.VITE_SIMULATE_MARKET_OPEN,
): SessionClock {
  const today = istDateKey(nowMs);
  const session = getNseSession(nowMs);
  if (session.phase === 'open') {
    const startMs = istTimeMs(today, NSE_OPEN.h, NSE_OPEN.m);
    const lengthMs = istTimeMs(today, NSE_CLOSE.h, NSE_CLOSE.m) - startMs;
    return { mode: 'nse-hours', sessionKey: `nse:${today}`, startMs, lengthMs };
  }
  if (simulateOutsideHours) {
    return {
      mode: 'extended',
      sessionKey: `ext:${today}`,
      startMs: istTimeMs(today),
      lengthMs: 86_400_000,
    };
  }
  return { mode: 'frozen', sessionKey: `frozen:${today}`, startMs: nowMs, lengthMs: 1 };
}

export function tradeWindow(clock: SessionClock, tickMs: number, maxTicks: number): TradeWindow {
  if (clock.mode === 'nse-hours') return { from: 0, to: maxTicks };
  const day = clock.sessionKey.slice(clock.sessionKey.indexOf(':') + 1);
  if (clock.mode === 'frozen' || !isTradingDay(day)) return { from: 0, to: 0 };
  const open = istTimeMs(day, NSE_OPEN.h, NSE_OPEN.m);
  const close = istTimeMs(day, NSE_CLOSE.h, NSE_CLOSE.m);
  return {
    from: Math.ceil((open - clock.startMs) / tickMs),
    to: Math.floor((close - clock.startMs) / tickMs),
  };
}

export function marketKey(dataset: Dataset, clock: SessionClock, tickMs: number): string {
  return `${dataset.seed}|${dataset.asOfDate}|${clock.sessionKey}|${tickMs}`;
}

export function getMarketSnapshot(
  dataset: Dataset,
  nowMs: number,
  schedule: (key: string, window: TradeWindow) => readonly ScheduledTrade[],
  tickMs: number = env.VITE_TICK_INTERVAL_MS,
  simulateOutsideHours: boolean = env.VITE_SIMULATE_MARKET_OPEN,
  maxSteps: number = Number.POSITIVE_INFINITY,
): MarketSnapshot {
  const clock = sessionClock(nowMs, simulateOutsideHours);
  const maxTicks = Math.max(1, Math.floor(clock.lengthMs / tickMs));
  const targetTick =
    clock.mode === 'frozen'
      ? 0
      : Math.min(maxTicks, Math.max(0, Math.floor((nowMs - clock.startMs) / tickMs)));
  const key = marketKey(dataset, clock, tickMs);
  const n = dataset.constituents.length;

  if (state?.key !== key || state.tick > targetTick) {
    state = { key, tick: 0, logCum: new Array<number>(n).fill(0), factorCum: 0, fills: new Map() };
  }

  const window = tradeWindow(clock, tickMs, maxTicks);
  const trades = schedule(key, window);
  const byTick = new Map<number, number[]>();
  for (const t of trades) {
    const list = byTick.get(t.tick) ?? [];
    list.push(t.constituentIndex);
    byTick.set(t.tick, list);
  }

  const referenceCloses = dataset.constituents.map((_, i) => lastClose(dataset, i));
  const perTick = Math.sqrt(1 / maxTicks);
  const factorVol = INTRADAY_FACTOR_VOL * perTick;
  const idio = dataset.constituents.map((c) => (c.idioVol / Math.sqrt(252)) * perTick);

  const recordFills = (t: number, s: SimState) => {
    for (const index of byTick.get(t) ?? []) {
      const price = (referenceCloses[index] ?? 0) * Math.exp(s.logCum[index] ?? 0);
      s.fills.set(`${t}:${index}`, Math.round(price * 100) / 100);
    }
  };
  if (state.tick === 0) recordFills(0, state);
  // Optionally advance only part of the way so callers can yield between slices.
  const tick = Math.min(targetTick, state.tick + maxSteps);

  for (let t = state.tick + 1; t <= tick; t += 1) {
    const rng = createRng(hashSeed(key, t));
    const f = factorVol * normal(rng);
    state.factorCum += f;
    for (let i = 0; i < n; i += 1) {
      const c = dataset.constituents[i];
      const sigma = idio[i] ?? 0;
      if (!c) continue;
      state.logCum[i] =
        (state.logCum[i] ?? 0) + c.beta * f + sigma * normal(rng) - 0.5 * sigma * sigma;
    }
    recordFills(t, state);
  }
  state.tick = tick;
  const current = state;

  return {
    asOfMs: clock.mode === 'frozen' ? nowMs : clock.startMs + tick * tickMs,
    mode: clock.mode,
    sessionKey: clock.sessionKey,
    scheduleKey: key,
    tradeWindow: window,
    sessionDate: clock.sessionKey.slice(clock.sessionKey.indexOf(':') + 1),
    sessionStartMs: clock.startMs,
    tickMs,
    tick,
    maxTicks,
    prices: referenceCloses.map(
      (close, i) => Math.round(close * Math.exp(current.logCum[i] ?? 0) * 100) / 100,
    ),
    referenceCloses,
    benchmarkChange: Math.exp(current.factorCum) - 1,
    caughtUp: tick === targetTick,
    fills: current.fills,
  };
}

/** Ticks simulated per slice when catching up (roughly 10 ms of work). */
export const PRIME_SLICE_TICKS = 1200;

/**
 * Catch the simulated tape up to `nowMs` in slices, yielding to the browser between slices so
 * the first request after load (which may replay a whole day of ticks) never blocks input.
 */
export async function primeMarket(
  dataset: Dataset,
  nowMs: number,
  schedule: (key: string, window: TradeWindow) => readonly ScheduledTrade[],
  tickMs: number = env.VITE_TICK_INTERVAL_MS,
  simulateOutsideHours: boolean = env.VITE_SIMULATE_MARKET_OPEN,
): Promise<void> {
  for (;;) {
    const snap = getMarketSnapshot(
      dataset,
      nowMs,
      schedule,
      tickMs,
      simulateOutsideHours,
      PRIME_SLICE_TICKS,
    );
    if (snap.caughtUp) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

/** For tests: forget the cached simulation state. */
export function resetMarketSimulation(): void {
  state = null;
}
