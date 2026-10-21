import { describe, expect, it } from 'vitest';
import {
  direction,
  directionArrow,
  formatInr,
  formatInrCompact,
  formatMoneyCompact,
  formatNumber,
  formatPct,
  formatUsdCompact,
  MINUS,
} from '@/utils/format';
import {
  addTradingDays,
  formatAge,
  formatIstTime,
  getNseSession,
  isTradingDay,
  istDateKey,
  istTimeMs,
  lastCompletedTradingDay,
  settlementDate,
  toIstIso,
  tradingDaysEnding,
} from '@/utils/time';

describe('INR / USD formatting', () => {
  it('uses Indian digit grouping', () => {
    expect(formatInr(1234567.891)).toBe('₹12,34,567.89');
    expect(formatNumber(10000000)).toBe('1,00,00,000');
  });

  it('formats crore and lakh compactly', () => {
    expect(formatInrCompact(3_757_500_000_000)).toBe('₹3,75,750 Cr');
    expect(formatInrCompact(1_250_000)).toBe('₹12.50 L');
    expect(formatInrCompact(-25_000_000, true)).toBe(`${MINUS}₹2.50 Cr`);
  });

  it('formats USD with B/M suffixes', () => {
    expect(formatUsdCompact(45_000_000_000)).toBe('$45.0B');
    expect(formatUsdCompact(312_400_000)).toBe('$312.4M');
    expect(formatMoneyCompact(83.5e9, 'USD', 83.5)).toBe('$1.0B');
  });

  it('always signs percentages and pairs direction with an arrow', () => {
    expect(formatPct(0.0123)).toBe('+1.23%');
    expect(formatPct(-0.0123)).toBe(`${MINUS}1.23%`);
    expect(formatPct(0)).toBe('0.00%');
    expect(directionArrow(0.1)).toBe('▲');
    expect(directionArrow(-0.1)).toBe('▼');
    expect(direction(0)).toBe('flat');
  });
});

describe('IST and the NSE calendar', () => {
  it('converts UTC to IST (UTC+05:30, no DST)', () => {
    const ms = Date.UTC(2026, 9, 20, 3, 45, 0);
    expect(toIstIso(ms)).toBe('2026-10-20T09:15:00+05:30');
    expect(formatIstTime(ms)).toBe('09:15:00 IST');
    expect(istDateKey(Date.UTC(2026, 9, 20, 19, 0))).toBe('2026-10-21');
  });

  it('knows weekends and listed holidays are not trading days', () => {
    expect(isTradingDay('2026-10-17')).toBe(false); // Saturday
    expect(isTradingDay('2026-10-02')).toBe(false); // Gandhi Jayanti
    expect(isTradingDay('2026-10-20')).toBe(true);
  });

  it('settles T+1 on the next trading day', () => {
    expect(settlementDate('2026-10-20')).toBe('2026-10-21');
    expect(settlementDate('2026-10-16')).toBe('2026-10-19'); // Friday -> Monday
    expect(settlementDate('2026-10-01')).toBe('2026-10-05'); // skips the 2 Oct holiday + weekend
    expect(addTradingDays('2026-10-19', -1)).toBe('2026-10-16');
  });

  it('builds trading-day windows oldest first', () => {
    const days = tradingDaysEnding('2026-10-20', 5);
    expect(days).toEqual(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20']);
  });

  it('reports NSE session phases: pre-open 09:00-09:15, open 09:15-15:30', () => {
    expect(getNseSession(istTimeMs('2026-10-20', 8, 59)).phase).toBe('closed');
    expect(getNseSession(istTimeMs('2026-10-20', 9, 5)).phase).toBe('pre-open');
    expect(getNseSession(istTimeMs('2026-10-20', 9, 15)).phase).toBe('open');
    expect(getNseSession(istTimeMs('2026-10-20', 15, 29)).phase).toBe('open');
    expect(getNseSession(istTimeMs('2026-10-20', 15, 30)).phase).toBe('closed');
    expect(getNseSession(istTimeMs('2026-10-18', 11, 0)).label).toContain('Weekend');
  });

  it('uses the previous session close until 15:30', () => {
    expect(lastCompletedTradingDay(istTimeMs('2026-10-20', 12, 0))).toBe('2026-10-19');
    expect(lastCompletedTradingDay(istTimeMs('2026-10-20', 16, 0))).toBe('2026-10-20');
  });

  it('formats ages', () => {
    expect(formatAge(12_000)).toBe('12s ago');
    expect(formatAge(5 * 60_000)).toBe('5m ago');
  });
});
