import { normal, type Rng } from '../random';

/** Trading days per year used for annualising. */
export const TRADING_DAYS = 252;

export interface GbmParams {
  /** Annual drift (mu). */
  drift: number;
  /** Annual volatility (sigma). */
  volatility: number;
  /** Price of the last point. The path is scaled so it ends here (scaling keeps GBM returns). */
  endPrice: number;
  /**
   * Optional common factor: daily simple returns shared with other series (the simulated
   * market). Each step adds `beta × ln(1 + factor[t])` in log space.
   */
  factor?: readonly number[];
  beta?: number;
}

/**
 * Geometric Brownian motion price path with `steps` daily steps (`steps + 1` prices):
 * ln S(t+1) = ln S(t) + (mu − σ²/2)·dt + σ·√dt·Z, plus an optional beta-scaled market factor.
 * Prices stay strictly positive by construction.
 */
export function gbmPath(rng: Rng, steps: number, params: GbmParams): number[] {
  const dt = 1 / TRADING_DAYS;
  const { drift, volatility: sigma, factor, beta = 0 } = params;
  const logs = [0];
  let acc = 0;
  for (let t = 0; t < steps; t += 1) {
    const common = factor ? beta * Math.log(1 + (factor[t] ?? 0)) : 0;
    acc += common + (drift - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * normal(rng);
    logs.push(acc);
  }
  const last = logs[logs.length - 1] ?? 0;
  return logs.map((l) => params.endPrice * Math.exp(l - last));
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 erf approximation, error < 1.5e-7). */
export function normalCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

export interface OptionInputs {
  kind: 'call' | 'put';
  spot: number;
  strike: number;
  /** Years to expiry. */
  years: number;
  rate: number;
  volatility: number;
}

/** Black–Scholes price and delta of a European option (no dividends). */
export function blackScholes(o: OptionInputs): { price: number; delta: number } {
  const years = Math.max(o.years, 1 / 365);
  const sd = o.volatility * Math.sqrt(years);
  const d1 = (Math.log(o.spot / o.strike) + (o.rate + 0.5 * o.volatility ** 2) * years) / sd;
  const d2 = d1 - sd;
  const discount = Math.exp(-o.rate * years);
  if (o.kind === 'call') {
    return {
      price: o.spot * normalCdf(d1) - o.strike * discount * normalCdf(d2),
      delta: normalCdf(d1),
    };
  }
  return {
    price: o.strike * discount * normalCdf(-d2) - o.spot * normalCdf(-d1),
    delta: normalCdf(d1) - 1,
  };
}

/** Rolling annualised volatility of daily returns over `window` days (NaN-free: early days use
 * what is available, the first day is 0). */
export function rollingVolatility(returns: readonly number[], window: number): number[] {
  return returns.map((_, t) => {
    const slice = returns.slice(Math.max(0, t - window + 1), t + 1);
    if (slice.length < 2) return 0;
    const m = slice.reduce((s, r) => s + r, 0) / slice.length;
    const v = slice.reduce((s, r) => s + (r - m) ** 2, 0) / (slice.length - 1);
    return Math.sqrt(v * TRADING_DAYS);
  });
}

/** Poisson draw (Knuth). Fine for the small rates used here. */
export function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > limit);
  return k - 1;
}
