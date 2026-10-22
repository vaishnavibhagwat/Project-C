import type { MetricsData, SummaryData, VarData } from '@/data/schemas';
import {
  formatInrCompact,
  formatPct,
  formatRatio,
  formatUsdCompact,
  type Direction,
} from '@/utils/format';
import { formatDateKey, istDateKey } from '@/utils/time';

/**
 * Portfolio Summary Strip model. Every ratio is a fraction (0.0316 = 3.16%) and money is INR
 * unless the name says USD. The strip renders this shape whatever the source: the shared mock
 * dataset in the app (toSummaryStripData), or PLACEHOLDER_SUMMARY_STRIP in stories and tests.
 */
export interface SummaryStripData {
  /** IST ISO timestamp of the data. */
  asOf: string;
  aumUsd: number;
  aumInr: number;
  /** Intraday market value against AUM at the last close. */
  intradayChange: number;
  dailyPnlInr: number;
  dailyPnlChange: number;
  mtdReturn: number;
  ytdReturn: number;
  /** First day of the return history used for Sharpe, volatility and drawdown. */
  periodStart: string;
  riskFreeRate: number;
  sharpe: number;
  sharpe12m: number;
  volatility: number;
  volatility12m: number;
  var99: number;
  var99Inr: number;
  varLimit: number;
  varLookbackDays: number;
  /** Positive fractions: 0.353 is a 35.3% fall from the peak. */
  maxDrawdown: number;
  drawdownPeakDate: string;
  drawdownTroughDate: string;
  currentDrawdown: number;
}

/**
 * Illustrative values for stories and tests until a component is wired to data. Not taken
 * from the dataset and never shown in the running app.
 */
export const PLACEHOLDER_SUMMARY_STRIP: SummaryStripData = {
  asOf: '2026-10-20T11:42:00+05:30',
  aumUsd: 45_000_000_000,
  aumInr: 3_757_500_000_000,
  intradayChange: 0.0042,
  dailyPnlInr: 15_781_500_000,
  dailyPnlChange: 0.0042,
  mtdReturn: 0.0316,
  ytdReturn: 0.1413,
  periodStart: '2021-09-15',
  riskFreeRate: 0.0675,
  sharpe: 0.75,
  sharpe12m: 1.12,
  volatility: 0.136,
  volatility12m: 0.118,
  var99: 0.0166,
  var99Inr: 62_520_000_000,
  varLimit: 0.02,
  varLookbackDays: 252,
  maxDrawdown: 0.353,
  drawdownPeakDate: '2023-10-31',
  drawdownTroughDate: '2024-02-09',
  currentDrawdown: 0.004,
};

export type SummaryMetricId =
  'aum' | 'dailyPnl' | 'mtd' | 'ytd' | 'sharpe' | 'volatility' | 'var' | 'maxDrawdown';

export interface SummaryChange {
  /** Signed amount; its sign picks the arrow. */
  amount: number;
  text: string;
  /** Which direction is good news: it picks emerald or coral. */
  goodWhen: Exclude<Direction, 'flat'>;
}

export interface SummaryTile {
  id: SummaryMetricId;
  label: string;
  /** `signed` values carry their own sign, arrow and colour (P&L, returns, drawdown). */
  value: { text: string; signed?: number };
  /** The comparison period, with an optional signed change against it. */
  comparison: { text: string; change?: SummaryChange };
  /** Plain-language explanation shown in the tile's tooltip. */
  tooltip: string;
}

function monthStart(asOf: string, withYear: boolean, month?: number): string {
  const [y = '2026', m = '01'] = istDateKey(Date.parse(asOf)).split('-');
  const mm = month === undefined ? m : String(month).padStart(2, '0');
  return formatDateKey(`${y}-${mm}-01`, withYear);
}

/** The eight tiles, in display order. Pure, so the wording and colours are unit-tested. */
export function buildSummaryTiles(d: SummaryStripData): SummaryTile[] {
  const since = formatDateKey(d.periodStart);
  // "Sep 2021": short enough for the tile; the tooltip gives the full date.
  const sinceMonth = since.split(' ').slice(1).join(' ');
  const varHeadroom = d.var99 - d.varLimit;
  return [
    {
      id: 'aum',
      label: 'AUM',
      value: { text: formatUsdCompact(d.aumUsd) },
      comparison: {
        text: 'intraday vs last close',
        change: { amount: d.intradayChange, text: formatPct(d.intradayChange), goodWhen: 'up' },
      },
      tooltip: `Assets under management at the last NSE close: ${formatUsdCompact(d.aumUsd)}, about ${formatInrCompact(d.aumInr)} at the fixed USD/INR rate set in .env (an assumption, not a live rate). The change is today's simulated move in the book's market value.`,
    },
    {
      id: 'dailyPnl',
      label: 'Daily P&L',
      value: { text: formatInrCompact(d.dailyPnlInr, true), signed: d.dailyPnlInr },
      comparison: {
        text: 'vs last close',
        change: { amount: d.dailyPnlChange, text: formatPct(d.dailyPnlChange), goodWhen: 'up' },
      },
      tooltip:
        "Today's profit or loss on the whole book: equities at simulated live prices against the last close. Bonds, gold, REITs and cash are held at their closing values.",
    },
    {
      id: 'mtd',
      label: 'MTD return',
      value: { text: formatPct(d.mtdReturn), signed: d.mtdReturn },
      comparison: { text: `since ${monthStart(d.asOf, false)}` },
      tooltip:
        'Month-to-date return of NAV per unit, measured from the last close of the previous month.',
    },
    {
      id: 'ytd',
      label: 'YTD return',
      value: { text: formatPct(d.ytdReturn), signed: d.ytdReturn },
      comparison: { text: `since ${monthStart(d.asOf, true, 1)}` },
      tooltip:
        'Year-to-date return of NAV per unit, measured from the last close of the previous year.',
    },
    {
      id: 'sharpe',
      label: 'Sharpe ratio',
      value: { text: formatRatio(d.sharpe) },
      comparison: {
        text: 'last 12 months',
        change: { amount: d.sharpe12m - d.sharpe, text: formatRatio(d.sharpe12m), goodWhen: 'up' },
      },
      tooltip: `Annualised return above the ${formatPct(d.riskFreeRate, 2, false)} risk-free rate, divided by annualised volatility, from daily returns since ${since}. Below it: the same ratio over the last 12 months. Higher is better.`,
    },
    {
      id: 'volatility',
      label: 'Volatility',
      value: { text: formatPct(d.volatility, 1, false) },
      comparison: {
        text: 'last 12 months',
        change: {
          amount: d.volatility12m - d.volatility,
          text: formatPct(d.volatility12m, 1, false),
          goodWhen: 'down',
        },
      },
      tooltip: `Annualised standard deviation of daily NAV returns (daily × √252) since ${since}. Below it: the last 12 months. Lower means steadier returns.`,
    },
    {
      id: 'var',
      label: 'VaR 99% · 1d',
      value: { text: formatPct(d.var99, 2, false) },
      comparison: {
        text: `${varHeadroom <= 0 ? 'under' : 'over'} ${formatPct(d.varLimit, 1, false)} limit`,
        change: {
          amount: varHeadroom,
          text: `${formatRatio(Math.abs(varHeadroom) * 100)} pts`,
          goodWhen: 'down',
        },
      },
      tooltip: `1-day 99% historical Value at Risk: the loss exceeded on only 1% of the last ${d.varLookbackDays} trading days, as a share of portfolio value (${formatInrCompact(d.var99Inr)}). Compared with the ${formatPct(d.varLimit, 1, false)} hard limit.`,
    },
    {
      id: 'maxDrawdown',
      label: 'Max drawdown',
      value: { text: formatPct(-d.maxDrawdown, 1), signed: -d.maxDrawdown },
      comparison: { text: `since ${sinceMonth} · now ${formatPct(-d.currentDrawdown, 1)}` },
      tooltip: `Largest fall in NAV from a peak to a later low since ${since} (${formatDateKey(d.drawdownPeakDate)} to ${formatDateKey(d.drawdownTroughDate)}). "Now" is how far NAV is below its running peak today.`,
    },
  ];
}

/** Build the strip from the shared mock dataset's endpoints (the same cache as the widgets). */
export function toSummaryStripData(
  summary: SummaryData,
  metrics: MetricsData,
  risk: VarData,
  varLimit: number,
): SummaryStripData {
  return {
    asOf: summary.asOf,
    aumUsd: summary.aumUsd,
    aumInr: summary.aum,
    intradayChange: summary.marketValueInr / summary.aum - 1,
    dailyPnlInr: summary.dailyPnL,
    dailyPnlChange: summary.dailyPnLPercent / 100,
    mtdReturn: summary.mtdReturn / 100,
    ytdReturn: summary.ytdReturn / 100,
    periodStart: metrics.periodStart,
    riskFreeRate: metrics.riskFreeRate,
    sharpe: summary.sharpeRatio,
    sharpe12m: metrics.oneYear.sharpe,
    volatility: metrics.annualVolatility,
    volatility12m: metrics.oneYear.volatility,
    var99: risk.historical.var99,
    var99Inr: risk.historical.var99 * risk.portfolioValueInr,
    varLimit,
    varLookbackDays: risk.lookbackDays,
    maxDrawdown: metrics.maxDrawdown,
    drawdownPeakDate: metrics.drawdownPeakDate,
    drawdownTroughDate: metrics.drawdownTroughDate,
    currentDrawdown: metrics.currentDrawdown,
  };
}
