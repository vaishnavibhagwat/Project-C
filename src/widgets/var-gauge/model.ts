import type { VarGaugeConfig, VarGaugeData } from './types';

/** Colour zones as shares of the limit: green below 70%, amber 70–90%, red above 90%. */
export const AMBER_FROM = 0.7;
export const RED_FROM = 0.9;

export type LimitStatus = 'within' | 'near' | 'breach';

export interface VarReading {
  /** Selected VaR as a positive fraction of AUM. */
  value: number;
  limit: number;
  /** value / limit. */
  utilisation: number;
  /** Zone: within (green), near (amber), breach (red: above 90% of the limit). */
  status: LimitStatus;
  /** True once VaR is at or above the limit itself. */
  overLimit: boolean;
  cvar: number | null;
}

type Pick95or99 = { var95: number; var99: number };
const pick = (v: Pick95or99, confidence: VarGaugeConfig['confidence']) =>
  confidence === '99' ? v.var99 : v.var95;

export function zoneFor(utilisation: number): LimitStatus {
  if (utilisation > RED_FROM) return 'breach';
  if (utilisation >= AMBER_FROM) return 'near';
  return 'within';
}

export function selectVar(data: VarGaugeData, config: VarGaugeConfig): VarReading {
  const value = pick(data[config.method], config.confidence);
  const limit = config.limitPct / 100;
  const utilisation = limit === 0 ? 0 : value / limit;
  const cvar =
    config.method === 'historical'
      ? config.confidence === '99'
        ? data.historical.cvar99
        : data.historical.cvar95
      : null;
  return {
    value,
    limit,
    utilisation,
    status: zoneFor(utilisation),
    overLimit: utilisation >= 1,
    cvar,
  };
}

/** Lowest and highest VaR over the 30-day history, for the selected method and confidence. */
export function rangeFor(
  data: VarGaugeData,
  config: VarGaugeConfig,
): { min: number; max: number; days: number } | null {
  const values = data.history.map((h) => pick(h[config.method], config.confidence));
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values), days: values.length };
}

/** Top of the dial: 125% of the limit, stretched if VaR or its range runs past that. */
export function gaugeMax(reading: VarReading, range: { max: number } | null): number {
  return Math.max(reading.limit * 1.25, reading.value * 1.1, (range?.max ?? 0) * 1.1);
}

export function statusLabel(r: VarReading): string {
  if (r.overLimit) return 'Limit breached';
  if (r.status === 'breach') return 'Near limit';
  if (r.status === 'near') return 'Approaching limit';
  return 'Within limit';
}
