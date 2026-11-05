import type { Sector } from '@/types';
import { ASSET_CLASSES, GEOGRAPHIES } from '../mock/instruments';
import { aggregate, bookTotals, modelStats } from '../model';
import { SECTORS } from '../nifty50';
import type {
  AllocationData,
  HoldingsData,
  NavHistoryData,
  PerformanceSeriesData,
  SectorReturnsData,
  SummaryData,
} from '../schemas';
import { asOfIso, liveBook, liveHoldings, round, type DeriveContext } from './context';

/** Identity of the simulated fund (fictional). */
export { PORTFOLIO_ID } from '../constants';
import { PORTFOLIO_ID } from '../constants';
export const PORTFOLIO_NAME = 'Meridian India Multi-Asset Fund';
export const BENCHMARK_NAME = 'Nifty 50 TRI';

const ASSET_CLASS_IDS = {
  Equity: 'equity',
  'Fixed Income': 'fixed-income',
  Derivatives: 'derivatives',
  Alternatives: 'alternatives',
} as const;

/** Every position of the book at live marks; weights are shares of the whole book. */
export function deriveHoldings(ctx: DeriveContext): HoldingsData {
  const rows = liveBook(ctx);
  const totals = bookTotals(rows);
  return {
    asOf: asOfIso(ctx),
    simulated: true,
    totalMarketValue: round(totals.marketValueInr, 2),
    holdings: rows.map((r) => ({
      holdingId: `HLD-${r.position.id.toUpperCase()}`,
      ticker: r.position.ticker,
      name: r.position.name,
      sector: r.position.sector,
      assetClass: r.position.assetClass,
      instrumentType: r.position.instrumentType,
      geography: r.position.geography,
      quantity: r.position.quantity,
      averageCost: r.position.averageCost,
      currentPrice: r.price,
      marketValue: round(r.marketValueInr, 2),
      dailyPnL: round(r.dailyPnlInr, 2),
      dailyPnLPercent: round(r.previousClose > 0 ? (r.price / r.previousClose - 1) * 100 : 0, 4),
      unrealisedPnL: round(r.unrealisedPnlInr, 2),
      costBasis: round(r.costBasisInr, 2),
      weight: r.weightPct,
      currency: r.position.currency,
    })),
  };
}

/** Asset classes, geographies and equity sectors: aggregates of the same valued book. */
export function deriveAllocation(ctx: DeriveContext): AllocationData {
  const rows = liveBook(ctx);
  const total = bookTotals(rows).marketValueInr;
  const equityRows = rows.filter((r) => r.position.assetClass === 'Equity');
  const equity = equityRows.reduce((s, r) => s + r.marketValueInr, 0);
  const presentSectors = SECTORS.filter((s) => equityRows.some((r) => r.position.sector === s));
  const sectors = aggregate<Sector>(equityRows, presentSectors, (r) => r.position.sector)
    .map((a) => ({
      sector: a.key,
      valueInr: round(a.valueInr, 2),
      weightPct: a.weightPct,
      portfolioWeightPct: (a.valueInr / total) * 100,
    }))
    .sort((a, b) => b.valueInr - a.valueInr);
  return {
    asOf: asOfIso(ctx),
    simulated: true,
    totalInr: round(total, 2),
    assetClasses: aggregate(rows, ASSET_CLASSES, (r) => r.position.assetClass).map((a) => ({
      id: ASSET_CLASS_IDS[a.key],
      label: a.key,
      valueInr: round(a.valueInr, 2),
      weightPct: a.weightPct,
    })),
    geographies: aggregate(rows, GEOGRAPHIES, (r) => r.position.geography).map((a) => ({
      geography: a.key,
      valueInr: round(a.valueInr, 2),
      weightPct: a.weightPct,
    })),
    sectors: equity > 0 ? sectors : [],
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
  const rows = liveBook(ctx);
  const totals = bookTotals(rows);
  const weightOf = (pick: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(pick).reduce((s, r) => s + r.weightPct, 0);
  const asOfDate = dataset.asOfDate;
  const navs = dataset.fundNav;
  const lastReturn = dataset.fundReturns[dataset.fundReturns.length - 1] ?? 0;

  const asOf = asOfIso(ctx);
  return {
    portfolioId: PORTFOLIO_ID,
    name: PORTFOLIO_NAME,
    aum: dataset.aumInr,
    dailyPnL: round(totals.dailyPnlInr, 2),
    dailyPnLPercent: round(totals.dailyPnlPct, 4),
    mtdReturn: round(returnSinceDate(dataset.dates, navs, asOfDate.slice(0, 7)), 4),
    ytdReturn: round(returnSinceDate(dataset.dates, navs, asOfDate.slice(0, 4)), 4),
    sharpeRatio: round(modelStats(dataset).sharpe, 4),
    benchmark: BENCHMARK_NAME,
    lastUpdated: asOf,
    asOf,
    simulated: true,
    sessionMode: market.mode,
    aumUsd: dataset.aumUsd,
    fxUsdInr: dataset.fxUsdInr,
    navPerUnit: round(navs[navs.length - 1] ?? 0, 4),
    navDayChangePct: round(lastReturn * 100, 4),
    marketValueInr: round(totals.marketValueInr, 2),
    benchmarkDayChangePct: round(
      (market.mode === 'frozen'
        ? (dataset.benchmarkReturns[dataset.benchmarkReturns.length - 1] ?? 0)
        : market.benchmarkChange) * 100,
      4,
    ),
    oneYearReturnPct: round(returnSince(navs, 252), 4),
    holdingsCount: rows.length,
    equityWeightPct: weightOf((r) => r.position.assetClass === 'Equity'),
    cashWeightPct: weightOf(
      (r) => r.position.instrumentType === 'Cash' || r.position.instrumentType === 'Treasury Bill',
    ),
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

/** The fund NAV and every benchmark series of the model, over the full history. */
export function derivePerformanceSeries(ctx: DeriveContext): PerformanceSeriesData {
  const { dataset } = ctx;
  return {
    asOf: asOfIso(ctx),
    simulated: true,
    inceptionDate: dataset.dates[0] ?? dataset.asOfDate,
    dates: dataset.dates,
    fund: dataset.fundNav.map((v) => round(v, 4)),
    benchmarks: dataset.benchmarks.map((b) => ({
      id: b.id,
      name: b.name,
      currency: b.currency,
      levels: b.levels.map((v) => round(v, 4)),
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

  const dateIndex = new Map(dataset.dates.map((d, i) => [d, i]));
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
          const k = dateIndex.get(column.key) ?? -1;
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
