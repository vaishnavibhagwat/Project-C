import type { VarGaugeConfig, VarGaugeData } from './types';

export type LimitStatus = 'within' | 'near' | 'breach';

export interface VarReading {
  /** Selected VaR as a positive fraction of AUM. */
  value: number;
  limit: number;
  utilisation: number;
  status: LimitStatus;
  cvar: number | null;
}

export function selectVar(data: VarGaugeData, config: VarGaugeConfig): VarReading {
  const is99 = config.confidence === '99';
  const value =
    config.method === 'historical'
      ? is99
        ? data.historical.var99
        : data.historical.var95
      : is99
        ? data.parametric.var99
        : data.parametric.var95;
  const limit = config.limitPct / 100;
  const utilisation = limit === 0 ? 0 : value / limit;
  const status: LimitStatus = utilisation >= 1 ? 'breach' : utilisation >= 0.75 ? 'near' : 'within';
  const cvar =
    config.method === 'historical'
      ? is99
        ? data.historical.cvar99
        : data.historical.cvar95
      : null;
  return { value, limit, utilisation, status, cvar };
}

export const STATUS_LABEL: Record<LimitStatus, string> = {
  within: 'Within limit',
  near: 'Near limit',
  breach: 'Limit breach',
};
