import { cssColor, CHART_SERIES } from '@/theme/themes';
import { formatPct } from '@/utils/format';
import { formatDateKey } from '@/utils/time';
import type {
  BenchmarkKey,
  ChartRow,
  ChartSeries,
  DateWindow,
  PerfPreset,
  PerformanceLineChartConfig,
  PerformanceLineChartData,
  SeriesKey,
} from './types';

/** The narrowest zoom: this many trading days. */
export const MIN_WINDOW_POINTS = 5;
/** Scroll and arrow keys move the window by this share of its length. */
export const PAN_STEP = 0.1;

const TOGGLES: Record<BenchmarkKey, keyof PerformanceLineChartConfig> = {
  NIFTY50: 'showNifty50',
  SENSEX: 'showSensex',
  SPX: 'showSpx',
  NIFTYBANK: 'showNiftyBank',
  NIFTYIT: 'showNiftyIt',
  NIFTYPHARMA: 'showNiftyPharma',
};

const SHORT: Record<SeriesKey, string> = {
  FUND: 'Fund',
  NIFTY50: 'Nifty 50',
  SENSEX: 'Sensex',
  SPX: 'S&P 500',
  NIFTYBANK: 'Bank',
  NIFTYIT: 'IT',
  NIFTYPHARMA: 'Pharma',
  CUSTOM: 'Custom',
};

/**
 * Custom benchmark: `niftyPct`% Nifty 50 and the rest S&P 500, rebalanced daily (the blend's
 * daily return is the weighted sum of the two). Starts at 100. FX is the fixed configured rate,
 * so S&P 500 returns are the same in USD and INR here.
 */
export function customLevels(data: PerformanceLineChartData, niftyPct: number): number[] {
  const nifty = data.benchmarks.find((b) => b.id === 'NIFTY50')?.levels ?? [];
  const spx = data.benchmarks.find((b) => b.id === 'SPX')?.levels ?? [];
  const w = niftyPct / 100;
  const out = [100];
  for (let t = 1; t < data.dates.length; t += 1) {
    const rn = (nifty[t] ?? 1) / (nifty[t - 1] ?? 1) - 1;
    const rs = (spx[t] ?? 1) / (spx[t - 1] ?? 1) - 1;
    out.push((out[t - 1] ?? 100) * (1 + w * rn + (1 - w) * rs));
  }
  return out;
}

/** The fund plus each benchmark switched on in the settings, fund first. */
export function selectedSeries(
  data: PerformanceLineChartData,
  config: PerformanceLineChartConfig,
): ChartSeries[] {
  const series: ChartSeries[] = [
    { key: 'FUND', name: 'Fund NAV', short: SHORT.FUND, levels: data.fund },
  ];
  for (const b of data.benchmarks) {
    if (config[TOGGLES[b.id]] === true) {
      series.push({ key: b.id, name: b.name, short: SHORT[b.id], levels: b.levels });
    }
  }
  if (config.showCustom) {
    series.push({
      key: 'CUSTOM',
      name: `Custom (${config.customNiftyPct}% Nifty 50 / ${100 - config.customNiftyPct}% S&P 500)`,
      short: SHORT.CUSTOM,
      levels: customLevels(data, config.customNiftyPct),
    });
  }
  return series;
}

function shiftDateKey(dateKey: string, months: number, days = 0): string {
  const [y = 0, m = 1, d = 1] = dateKey.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, d - days));
  return t.toISOString().slice(0, 10);
}

/** Index of the last trading day on or before `dateKey` (0 if none). */
function indexOnOrBefore(dates: readonly string[], dateKey: string): number {
  let lo = 0;
  let hi = dates.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((dates[mid] ?? '') <= dateKey) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/**
 * The window a preset shows, ending on the last day. It starts on the last close on or before
 * the same calendar date one period earlier; YTD starts on the last close of the previous year,
 * so its rebased end value is the year-to-date return.
 */
export function presetWindow(dates: readonly string[], preset: PerfPreset): DateWindow {
  const end = Math.max(0, dates.length - 1);
  const last = dates[end] ?? '';
  const target: Record<Exclude<PerfPreset, 'MAX'>, string> = {
    '1W': shiftDateKey(last, 0, 7),
    '1M': shiftDateKey(last, -1),
    '3M': shiftDateKey(last, -3),
    '6M': shiftDateKey(last, -6),
    '1Y': shiftDateKey(last, -12),
    YTD: `${Number(last.slice(0, 4)) - 1}-12-31`,
  };
  const start = preset === 'MAX' ? 0 : indexOnOrBefore(dates, target[preset]);
  return { start: Math.min(start, Math.max(0, end - 1)), end };
}

/** Keep a window inside the data and at least MIN_WINDOW_POINTS long (when the data allows). */
export function clampWindow(win: DateWindow, count: number): DateWindow {
  const last = Math.max(0, count - 1);
  const minLen = Math.min(MIN_WINDOW_POINTS, count) - 1;
  let start = Math.max(0, Math.min(Math.round(win.start), last));
  let end = Math.max(0, Math.min(Math.round(win.end), last));
  if (end < start) [start, end] = [end, start];
  if (end - start < minLen) {
    end = Math.min(last, start + minLen);
    start = Math.max(0, end - minLen);
  }
  return { start, end };
}

/** The window between two dragged-over indices (either order). */
export function zoomTo(a: number, b: number, count: number): DateWindow {
  return clampWindow({ start: Math.min(a, b), end: Math.max(a, b) }, count);
}

/** Move the window by `steps` × PAN_STEP of its length (negative = earlier), keeping its size. */
export function panWindow(win: DateWindow, steps: number, count: number): DateWindow {
  const len = win.end - win.start;
  const by = Math.sign(steps) * Math.max(1, Math.round(len * PAN_STEP * Math.abs(steps)));
  const start = Math.max(0, Math.min(win.start + by, count - 1 - len));
  return clampWindow({ start, end: start + len }, count);
}

/** Zoom around the window's centre: factor < 1 zooms in, > 1 zooms out. */
export function scaleWindow(win: DateWindow, factor: number, count: number): DateWindow {
  const centre = (win.start + win.end) / 2;
  const half = ((win.end - win.start) * factor) / 2;
  return clampWindow({ start: centre - half, end: centre + half }, count);
}

/** Rows for every date, each series rebased to 100 on the window's first day. */
export function rebasedRows(
  dates: readonly string[],
  series: readonly ChartSeries[],
  start: number,
): ChartRow[] {
  const bases = series.map((s) => s.levels[start] ?? s.levels[0] ?? 1);
  return dates.map((date, t) => {
    const row: ChartRow = { date };
    series.forEach((s, i) => {
      const v = s.levels[t];
      if (v !== undefined) row[s.key] = (v / (bases[i] ?? 1)) * 100;
    });
    return row;
  });
}

/** Return of each series over the window, as a fraction. */
export function windowReturns(
  series: readonly ChartSeries[],
  win: DateWindow,
): { key: SeriesKey; name: string; change: number }[] {
  return series.map((s) => {
    const a = s.levels[win.start] ?? 1;
    const b = s.levels[win.end] ?? a;
    return { key: s.key, name: s.name, change: b / a - 1 };
  });
}

const DASHES = ['4 3', '1 3', '6 2 1 2', '8 3', '2 2', '5 1', '3 4'];

/** Stroke colour and dash for each series. Every colour is a theme CSS variable. */
export function seriesStyle(
  config: PerformanceLineChartConfig,
  series: readonly ChartSeries[],
): Record<string, { stroke: string; dash?: string; width: number }> {
  // Accent is Series 1 in every built-in theme, so a fund in Accent also reserves Series 1.
  const reserved = config.fundColor === 'accent' ? 'chart1' : config.fundColor;
  const others = CHART_SERIES.filter((t) => t !== reserved);
  const styles: Record<string, { stroke: string; dash?: string; width: number }> = {};
  let i = 0;
  for (const s of series) {
    if (s.key === 'FUND') {
      styles[s.key] = { stroke: cssColor(config.fundColor), width: 2 };
      continue;
    }
    styles[s.key] =
      config.benchmarkColors === 'muted'
        ? { stroke: cssColor('textMuted', 0.9), dash: DASHES[i % DASHES.length], width: 1.25 }
        : { stroke: cssColor(others[i % others.length] ?? 'chart2'), width: 1.25 };
    i += 1;
  }
  return styles;
}

export function describeWindow(
  dates: readonly string[],
  series: readonly ChartSeries[],
  win: DateWindow,
): string {
  const from = dates[win.start];
  const to = dates[win.end];
  if (!from || !to) return 'No performance history.';
  const parts = windowReturns(series, win).map((r) => `${r.name} ${formatPct(r.change, 1)}`);
  return `From ${formatDateKey(from)} to ${formatDateKey(to)}, rebased to 100: ${parts.join(', ')}.`;
}
