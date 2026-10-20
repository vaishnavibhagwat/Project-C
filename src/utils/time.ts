import type { NseSessionStatus } from '@/types';

/** India Standard Time is a fixed UTC+05:30 offset with no daylight saving. */
export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 86_400_000;

export const NSE_PRE_OPEN = { h: 9, m: 0 } as const;
export const NSE_OPEN = { h: 9, m: 15 } as const;
export const NSE_CLOSE = { h: 15, m: 30 } as const;

/**
 * NSE trading holidays (weekday closures). Approximate list used for the simulation calendar;
 * check the official NSE circular for production use.
 */
export const NSE_HOLIDAYS: ReadonlySet<string> = new Set([
  '2021-01-26',
  '2021-03-11',
  '2021-03-29',
  '2021-04-02',
  '2021-04-14',
  '2021-04-21',
  '2021-05-13',
  '2021-07-21',
  '2021-08-19',
  '2021-09-10',
  '2021-10-15',
  '2021-11-04',
  '2021-11-05',
  '2021-11-19',
  '2022-01-26',
  '2022-03-01',
  '2022-03-18',
  '2022-04-14',
  '2022-04-15',
  '2022-05-03',
  '2022-08-09',
  '2022-08-15',
  '2022-08-31',
  '2022-10-05',
  '2022-10-24',
  '2022-10-26',
  '2022-11-08',
  '2023-01-26',
  '2023-03-07',
  '2023-03-30',
  '2023-04-04',
  '2023-04-07',
  '2023-04-14',
  '2023-05-01',
  '2023-06-28',
  '2023-08-15',
  '2023-09-19',
  '2023-10-02',
  '2023-10-24',
  '2023-11-14',
  '2023-11-27',
  '2023-12-25',
  '2024-01-26',
  '2024-03-08',
  '2024-03-25',
  '2024-03-29',
  '2024-04-11',
  '2024-04-17',
  '2024-05-01',
  '2024-06-17',
  '2024-07-17',
  '2024-08-15',
  '2024-10-02',
  '2024-11-01',
  '2024-11-15',
  '2024-12-25',
  '2025-02-26',
  '2025-03-14',
  '2025-03-31',
  '2025-04-10',
  '2025-04-14',
  '2025-04-18',
  '2025-05-01',
  '2025-08-15',
  '2025-08-27',
  '2025-10-02',
  '2025-10-21',
  '2025-10-22',
  '2025-11-05',
  '2025-12-25',
  '2026-01-26',
  '2026-03-03',
  '2026-03-26',
  '2026-03-31',
  '2026-04-03',
  '2026-04-14',
  '2026-05-01',
  '2026-05-28',
  '2026-06-26',
  '2026-09-14',
  '2026-10-02',
  '2026-11-10',
  '2026-11-24',
  '2026-12-25',
  '2027-01-26',
  '2027-03-22',
  '2027-03-26',
  '2027-04-14',
  '2027-05-01',
  '2027-08-16',
  '2027-10-29',
  '2027-12-24',
]);

export interface IstParts {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
  dateKey: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toIstParts(ms: number): IstParts {
  const shifted = new Date(ms + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  return {
    year,
    month,
    day,
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
    dateKey: `${year}-${pad(month)}-${pad(day)}`,
  };
}

export function istDateKey(ms: number): string {
  return toIstParts(ms).dateKey;
}

function parseDateKey(dateKey: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined || [y, m, d].some(Number.isNaN)) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return { y, m, d };
}

/** UTC epoch ms for a wall-clock time in IST on the given date. */
export function istTimeMs(dateKey: string, hours = 0, minutes = 0, seconds = 0): number {
  const { y, m, d } = parseDateKey(dateKey);
  return Date.UTC(y, m - 1, d, hours, minutes, seconds) - IST_OFFSET_MS;
}

export function addCalendarDays(dateKey: string, days: number): string {
  const { y, m, d } = parseDateKey(dateKey);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

function weekdayOf(dateKey: string): number {
  const { y, m, d } = parseDateKey(dateKey);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isTradingDay(dateKey: string): boolean {
  const weekday = weekdayOf(dateKey);
  return weekday !== 0 && weekday !== 6 && !NSE_HOLIDAYS.has(dateKey);
}

/** Move forward (n > 0) or backward (n < 0) by n trading days. */
export function addTradingDays(dateKey: string, n: number): string {
  const step = n >= 0 ? 1 : -1;
  let remaining = Math.abs(n);
  let current = dateKey;
  while (remaining > 0) {
    current = addCalendarDays(current, step);
    if (isTradingDay(current)) remaining -= 1;
  }
  return current;
}

/** T+1 settlement date for a trade executed on `tradeDateKey`. */
export function settlementDate(tradeDateKey: string): string {
  return addTradingDays(tradeDateKey, 1);
}

/** `count` trading days ending at (and including) `endKey`, oldest first. */
export function tradingDaysEnding(endKey: string, count: number): string[] {
  const days: string[] = [];
  let current = endKey;
  if (!isTradingDay(current)) current = addTradingDays(current, -1);
  while (days.length < count) {
    days.push(current);
    current = addTradingDays(current, -1);
  }
  return days.reverse();
}

/** The most recent trading day whose 15:30 close has already happened. */
export function lastCompletedTradingDay(nowMs: number): string {
  const today = istDateKey(nowMs);
  if (isTradingDay(today) && nowMs >= istTimeMs(today, NSE_CLOSE.h, NSE_CLOSE.m)) return today;
  return addTradingDays(today, -1);
}

export function getNseSession(nowMs: number): NseSessionStatus {
  const today = istDateKey(nowMs);
  const nextOpenDay = isTradingDay(today) ? today : addTradingDays(today, 1);
  const toIso = (ms: number) => toIstIso(ms);

  if (!isTradingDay(today)) {
    const weekday = weekdayOf(today);
    return {
      phase: 'closed',
      label: weekday === 0 || weekday === 6 ? 'Closed · Weekend' : 'Closed · Trading holiday',
      nextChange: toIso(istTimeMs(nextOpenDay, NSE_PRE_OPEN.h, NSE_PRE_OPEN.m)),
    };
  }
  const preOpen = istTimeMs(today, NSE_PRE_OPEN.h, NSE_PRE_OPEN.m);
  const open = istTimeMs(today, NSE_OPEN.h, NSE_OPEN.m);
  const close = istTimeMs(today, NSE_CLOSE.h, NSE_CLOSE.m);
  if (nowMs < preOpen) return { phase: 'closed', label: 'Closed', nextChange: toIso(preOpen) };
  if (nowMs < open) return { phase: 'pre-open', label: 'Pre-open', nextChange: toIso(open) };
  if (nowMs < close) return { phase: 'open', label: 'Market open', nextChange: toIso(close) };
  const tomorrow = addTradingDays(today, 1);
  return {
    phase: 'closed',
    label: 'Closed',
    nextChange: toIso(istTimeMs(tomorrow, NSE_PRE_OPEN.h, NSE_PRE_OPEN.m)),
  };
}

/** ISO-8601 string in IST, e.g. 2026-10-20T14:32:05+05:30. */
export function toIstIso(ms: number): string {
  const p = toIstParts(ms);
  return `${p.dateKey}T${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}+05:30`;
}

export function formatIstTime(ms: number, withSeconds = true): string {
  const p = toIstParts(ms);
  const base = `${pad(p.hours)}:${pad(p.minutes)}`;
  return `${withSeconds ? `${base}:${pad(p.seconds)}` : base} IST`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateKey(dateKey: string, withYear = true): string {
  const { y, m, d } = parseDateKey(dateKey);
  const month = MONTHS[m - 1] ?? '';
  return withYear ? `${d} ${month} ${y}` : `${d} ${month}`;
}

export function formatIstDateTime(ms: number): string {
  return `${formatDateKey(istDateKey(ms))}, ${formatIstTime(ms, false)}`;
}

/** Short relative age, e.g. "12s ago", "4m ago". */
export function formatAge(ageMs: number): string {
  const s = Math.max(0, Math.round(ageMs / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}
