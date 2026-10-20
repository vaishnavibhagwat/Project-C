import {
  addTradingDays,
  istDateKey,
  istTimeMs,
  isTradingDay,
  NSE_CLOSE,
  NSE_OPEN,
  settlementDate,
  toIstIso,
} from '@/utils/time';
import type { Dataset } from '../dataset';
import type { ScheduledTrade, TradeWindow } from '../market';
import { createRng, hashSeed, normal } from '../random';
import type { Trade, TradesData } from '../schemas';
import { asOfIso, type DeriveContext } from './context';

export const TRADES_PER_SESSION = 56;
const PREVIOUS_SESSION_TRADES = 28;

export interface PlannedTrade extends ScheduledTrade {
  side: 'BUY' | 'SELL';
  quantity: number;
  seq: number;
}

function lotSize(price: number, rngValue: number): number {
  // Order notional between roughly INR 2 Cr and INR 25 Cr, rounded to 25 shares.
  const notional = 2e7 + rngValue * 2.3e8;
  return Math.max(25, Math.round(notional / price / 25) * 25);
}

const scheduleCache = new Map<string, PlannedTrade[]>();

/** Deterministic order schedule for a session; the market sim prints fills at these ticks. */
export function createTradeSchedule(dataset: Dataset) {
  return (key: string, window: TradeWindow): PlannedTrade[] => {
    const cacheKey = `${key}|${window.from}|${window.to}`;
    const hit = scheduleCache.get(cacheKey);
    if (hit) return hit;
    if (window.to <= window.from) return [];
    const rng = createRng(hashSeed(key, 'orders'));
    const span = window.to - window.from;
    const planned: PlannedTrade[] = [];
    for (let seq = 0; seq < TRADES_PER_SESSION; seq += 1) {
      const holding = dataset.holdings[Math.floor(rng() * dataset.holdings.length)];
      if (!holding) continue;
      const closes = dataset.stockCloses[holding.constituentIndex] ?? [];
      const ref = closes[closes.length - 1] ?? 1;
      planned.push({
        seq,
        tick: window.from + Math.floor(rng() * span),
        constituentIndex: holding.constituentIndex,
        side: rng() < 0.55 ? 'BUY' : 'SELL',
        quantity: lotSize(ref, rng()),
      });
    }
    planned.sort((a, b) => a.tick - b.tick || a.seq - b.seq);
    scheduleCache.set(cacheKey, planned);
    return planned;
  };
}

function statusFor(settleDate: string, today: string): Trade['status'] {
  if (settleDate < today) return 'Settled';
  if (settleDate === today) return 'Settling';
  return 'Filled';
}

/** Trades from the previous session, priced off that day's close. */
function previousSessionTrades(dataset: Dataset, tradeDate: string, today: string): Trade[] {
  const dayIndex = dataset.dates.indexOf(tradeDate);
  if (dayIndex < 0) return [];
  const rng = createRng(hashSeed(dataset.seed, tradeDate, 'prev-orders'));
  const open = istTimeMs(tradeDate, NSE_OPEN.h, NSE_OPEN.m);
  const close = istTimeMs(tradeDate, NSE_CLOSE.h, NSE_CLOSE.m);
  const trades: Trade[] = [];
  for (let seq = 0; seq < PREVIOUS_SESSION_TRADES; seq += 1) {
    const holding = dataset.holdings[Math.floor(rng() * dataset.holdings.length)];
    if (!holding) continue;
    const dayClose = dataset.stockCloses[holding.constituentIndex]?.[dayIndex] ?? 1;
    const fill = Math.round(dayClose * Math.exp(0.004 * normal(rng)) * 100) / 100;
    const quantity = lotSize(dayClose, rng());
    const side: Trade['side'] = rng() < 0.55 ? 'BUY' : 'SELL';
    const time = open + Math.floor(rng() * (close - open));
    const settle = settlementDate(tradeDate);
    trades.push({
      id: `T${tradeDate.replace(/-/g, '')}-${String(seq).padStart(3, '0')}`,
      tradeDate,
      time: toIstIso(time),
      symbol: holding.symbol,
      name: holding.name,
      side,
      quantity,
      price: fill,
      valueInr: Math.round(fill * quantity * 100) / 100,
      settlementDate: settle,
      status: statusFor(settle, today),
      venue: 'NSE',
    });
  }
  return trades;
}

export function deriveTrades(
  ctx: DeriveContext,
  schedule = createTradeSchedule(ctx.dataset),
): TradesData {
  const { dataset, market, nowMs } = ctx;
  const today = istDateKey(nowMs);
  const planned = schedule(market.scheduleKey, market.tradeWindow);

  const todays: Trade[] = [];
  for (const p of planned) {
    if (p.tick > market.tick) break;
    const fill = market.fills.get(`${p.tick}:${p.constituentIndex}`);
    const holding = dataset.holdings.find((h) => h.constituentIndex === p.constituentIndex);
    if (fill === undefined || !holding) continue;
    const settle = settlementDate(market.sessionDate);
    todays.push({
      id: `T${market.sessionDate.replace(/-/g, '')}-${String(p.seq).padStart(3, '0')}`,
      tradeDate: market.sessionDate,
      time: toIstIso(market.sessionStartMs + p.tick * market.tickMs),
      symbol: holding.symbol,
      name: holding.name,
      side: p.side,
      quantity: p.quantity,
      price: fill,
      valueInr: Math.round(fill * p.quantity * 100) / 100,
      settlementDate: settle,
      status: statusFor(settle, today),
      venue: 'NSE',
    });
  }

  const previousDate = isTradingDay(today) ? addTradingDays(today, -1) : dataset.asOfDate;
  const previous = previousSessionTrades(dataset, previousDate, today);
  const trades = [...todays.reverse(), ...previous.sort((a, b) => b.time.localeCompare(a.time))];
  return { asOf: asOfIso(ctx), simulated: true, tradeDate: market.sessionDate, trades };
}
