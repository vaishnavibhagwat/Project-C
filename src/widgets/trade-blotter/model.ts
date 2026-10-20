import type { Trade, TradeBlotterConfig } from './types';

export function filterTrades(trades: readonly Trade[], config: TradeBlotterConfig): Trade[] {
  return trades.filter(
    (t) =>
      (config.side === 'ALL' || t.side === config.side) &&
      (config.status === 'ALL' || t.status === config.status),
  );
}

export function flows(trades: readonly Trade[]) {
  let buy = 0;
  let sell = 0;
  for (const t of trades) {
    if (t.side === 'BUY') buy += t.valueInr;
    else sell += t.valueInr;
  }
  return { buy, sell, net: buy - sell };
}
