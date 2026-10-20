import type { Sector } from '@/types';
import { SECTORS } from '../nifty50';
import type {
  AllocationData,
  HoldingsData,
  NavHistoryData,
  SectorReturnsData,
  SummaryData,
} from '../schemas';
import { asOfIso, liveHoldings, nonEquityValueInr, round, type DeriveContext } from './context';

export function deriveHoldings(ctx: DeriveContext): HoldingsData {
  const live = liveHoldings(ctx);
  const total = live.reduce((s, h) => s + h.marketValueInr, 0);
  return {
    asOf: asOfIso(ctx),
    simulated: true,
    totalMarketValueInr: round(total, 2),
    holdings: live.map(({ holding, ltp, prevClose, marketValueInr }) => ({
      symbol: holding.symbol,
      name: holding.name,
      sector: holding.sector,
      quantity: holding.quantity,
      avgCost: holding.avgCost,
      ltp,
      prevClose: round(prevClose, 2),
      marketValueInr: round(marketValueInr, 2),
      weightPct: (marketValueInr / total) * 100,
      dayChangePct: round((ltp / prevClose - 1) * 100, 4),
      dayPnlInr: round(holding.quantity * (ltp - prevClose), 2),
      unrealisedPnlInr: round(holding.quantity * (ltp - holding.avgCost), 2),
      unrealisedPnlPct: round((ltp / holding.avgCost - 1) * 100, 4),
    })),
  };
}

export function deriveAllocation(ctx: DeriveContext): AllocationData {
  const live = liveHoldings(ctx);
  const equity = live.reduce((s, h) => s + h.marketValueInr, 0);
  const others = ctx.dataset.assetClasses.filter((a) => a.id !== 'equity');
  const total = equity + nonEquityValueInr(ctx.dataset);

  const bySector = new Map<Sector, number>();
  for (const h of live) {
    bySector.set(h.holding.sector, (bySector.get(h.holding.sector) ?? 0) + h.marketValueInr);
  }
  const sectors = [...bySector.entries()]
    .map(([sector, valueInr]) => ({
      sector,
      valueInr: round(valueInr, 2),
      weightPct: (valueInr / equity) * 100,
      portfolioWeightPct: (valueInr / total) * 100,
    }))
    .sort((a, b) => b.valueInr - a.valueInr);

  return {
    asOf: asOfIso(ctx),
    simulated: true,
    totalInr: round(total, 2),
    assetClasses: [
      {
        id: 'equity',
        label: 'Indian Equity',
        valueInr: round(equity, 2),
        weightPct: (equity / total) * 100,
      },
      ...others.map((a) => ({
        id: a.id,
        label: a.label,
        valueInr: round(a.valueInr, 2),
        weightPct: (a.valueInr / total) * 100,
      })),
    ],
    sectors,
  };
}

function returnSince(levels: readonly number[], days: number): number {
  const last = levels[levels.length - 1] ?? 0;
  const base = levels[Math.max(0, levels.length - 1 - days)] ?? last;
  return base === 0 ? 0 : (last / base - 1) * 100;
}

function returnSinceDate(
  dates: readonly string[],
  levels: readonly number[],
  prefix: string,
): number {
  // Base = last close before the first date that starts with `prefix` (month or year).
  const firstIndex = dates.findIndex((d) => d.startsWith(prefix));
  const baseIndex = firstIndex <= 0 ? 0 : firstIndex - 1;
  const base = levels[baseIndex] ?? 0;
  const last = levels[levels.length - 1] ?? 0;
  return base === 0 ? 0 : (last / base - 1) * 100;
}

export function deriveSummary(ctx: DeriveContext): SummaryData {
  const { dataset, market } = ctx;
  const live = liveHoldings(ctx);
  const equity = live.reduce((s, h) => s + h.marketValueInr, 0);
  const equityPrev = live.reduce((s, h) => s + h.prevValueInr, 0);
  const others = nonEquityValueInr(dataset);
  const marketValue = equity + others;
  const dayPnl = equity - equityPrev;
  const cash = dataset.assetClasses.find((a) => a.id === 'cash')?.valueInr ?? 0;
  const asOfDate = dataset.asOfDate;
  const navs = dataset.fundNav;
  const lastReturn = dataset.fundReturns[dataset.fundReturns.length - 1] ?? 0;

  return {
    asOf: asOfIso(ctx),
    simulated: true,
    sessionMode: market.mode,
    aumUsd: dataset.aumUsd,
    aumInr: dataset.aumInr,
    fxUsdInr: dataset.fxUsdInr,
    navPerUnit: round(navs[navs.length - 1] ?? 0, 4),
    navDayChangePct: round(lastReturn * 100, 4),
    marketValueInr: round(marketValue, 2),
    dayPnlInr: round(dayPnl, 2),
    dayChangePct: round((dayPnl / (equityPrev + others)) * 100, 4),
    benchmarkDayChangePct: round(
      (market.mode === 'frozen'
        ? (dataset.benchmarkReturns[dataset.benchmarkReturns.length - 1] ?? 0)
        : market.benchmarkChange) * 100,
      4,
    ),
    mtdReturnPct: round(returnSinceDate(dataset.dates, navs, asOfDate.slice(0, 7)), 4),
    ytdReturnPct: round(returnSinceDate(dataset.dates, navs, asOfDate.slice(0, 4)), 4),
    oneYearReturnPct: round(returnSince(navs, 252), 4),
    holdingsCount: dataset.holdings.length,
    equityWeightPct: (equity / marketValue) * 100,
    cashWeightPct: (cash / marketValue) * 100,
  };
}

export function deriveNavHistory(ctx: DeriveContext): NavHistoryData {
  const { dataset } = ctx;
  return {
    asOf: asOfIso(ctx),
    simulated: true,
    inceptionDate: dataset.dates[0] ?? dataset.asOfDate,
    points: dataset.dates.map((date, i) => ({
      date,
      nav: round(dataset.fundNav[i] ?? 0, 4),
      benchmark: round(dataset.benchmarkLevels[i] ?? 0, 4),
    })),
  };
}

export const HEATMAP_DAYS = 20;

/** Holdings-weighted sector returns for recent sessions, plus the live session if ticking. */
export function deriveSectorReturns(ctx: DeriveContext): SectorReturnsData {
  const { dataset, market } = ctx;
  const live = liveHoldings(ctx);
  const equity = live.reduce((s, h) => s + h.marketValueInr, 0);
  const n = dataset.dates.length;
  const startIndex = Math.max(1, n - HEATMAP_DAYS);
  const columns: SectorReturnsData['columns'] = [];
  for (let k = startIndex; k < n; k += 1) {
    const date = dataset.dates[k] ?? '';
    columns.push({ key: date, label: date.slice(5), intraday: false });
  }
  if (market.mode !== 'frozen') columns.push({ key: 'live', label: 'Live', intraday: true });

  const sectors = SECTORS.filter((s) => live.some((h) => h.holding.sector === s));
  const cells: SectorReturnsData['cells'] = [];
  for (const sector of sectors) {
    const members = live.filter((h) => h.holding.sector === sector);
    const sectorValue = members.reduce((s, h) => s + h.marketValueInr, 0);
    const weightPct = (sectorValue / equity) * 100;
    for (const column of columns) {
      let acc = 0;
      for (const m of members) {
        const w = m.marketValueInr / sectorValue;
        let r: number;
        if (column.intraday) {
          r = m.ltp / m.prevClose - 1;
        } else {
          const k = dataset.dates.indexOf(column.key);
          const closes = dataset.stockCloses[m.holding.constituentIndex] ?? [];
          const prev = closes[k - 1] ?? 0;
          r = prev === 0 ? 0 : (closes[k] ?? prev) / prev - 1;
        }
        acc += w * r;
      }
      cells.push({ sector, column: column.key, returnPct: round(acc * 100, 4), weightPct });
    }
  }
  return { asOf: asOfIso(ctx), simulated: true, columns, sectors, cells };
}
