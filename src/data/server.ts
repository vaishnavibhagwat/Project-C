import type { EndpointId } from '@/types';
import { getNseSession } from '@/utils/time';
import { lastClose, previousClose } from './dataset';
import { liveHoldings, type DeriveContext } from './derive/context';
import { PORTFOLIO_ID } from './derive/portfolio';
import { createTradeSchedule } from './derive/trades';
import { ENDPOINTS, type EndpointDataMap } from './endpoints';
import { getMarketSnapshot, primeMarket } from './market';
import { getPortfolioModel } from './model';
import type { MessageBuilder } from './wsSimulator';

/**
 * The simulated back end: the portfolio model, the intraday tape and every endpoint's
 * derivation. Loaded as its own chunk on the first request (fetchEndpoint, the simulated
 * WebSocket), so none of it weighs on the main bundle.
 */

export function buildContext(nowMs: number): DeriveContext {
  const dataset = getPortfolioModel(nowMs);
  const market = getMarketSnapshot(dataset, nowMs, createTradeSchedule(dataset));
  return { dataset, market, nowMs };
}

/** The raw (not yet serialised or validated) response of an endpoint at `nowMs`. */
export async function serveEndpoint<E extends EndpointId>(
  endpoint: E,
  nowMs: number,
): Promise<EndpointDataMap[E]> {
  const dataset = getPortfolioModel(nowMs);
  await primeMarket(dataset, nowMs, createTradeSchedule(dataset));
  return ENDPOINTS[endpoint].derive(buildContext(nowMs));
}

const pctChange = (last: number, prev: number) => (prev > 0 ? (last / prev - 1) * 100 : 0);

/** Builds messages from the shared dataset and the intraday tape (the same prices as the API). */
export const buildFromDataset: MessageBuilder = async ({ kind, portfolioId, nowMs, seen }) => {
  const dataset = getPortfolioModel(nowMs);
  await primeMarket(dataset, nowMs, createTradeSchedule(dataset));
  const ctx = buildContext(nowMs);
  switch (kind) {
    case 'prices':
      return {
        type: 'prices',
        portfolioId: portfolioId ?? PORTFOLIO_ID,
        prices: liveHoldings(ctx).map((h) => ({
          ticker: h.holding.symbol,
          price: h.ltp,
          previousClose: h.prevClose,
          changePct: pctChange(h.ltp, h.prevClose),
        })),
      };
    case 'ticker': {
      const frozen = ctx.market.mode === 'frozen';
      return {
        type: 'ticker',
        session: getNseSession(nowMs).phase,
        quotes: dataset.constituents.map((c, i) => {
          const last = frozen
            ? lastClose(dataset, i)
            : (ctx.market.prices[i] ?? lastClose(dataset, i));
          const prev = frozen ? previousClose(dataset, i) : (ctx.market.referenceCloses[i] ?? last);
          return { symbol: c.symbol, last, changePct: pctChange(last, prev) };
        }),
      };
    }
    case 'alerts':
      return {
        type: 'alerts',
        alerts: ENDPOINTS['alerts/active'].derive(ctx).alerts.filter((a) => !seen.has(a.alertId)),
      };
    case 'news':
      return {
        type: 'news',
        articles: [
          ...ENDPOINTS['market/news'].derive(ctx).articles,
          ...ENDPOINTS['research/feed'].derive(ctx).articles,
        ].filter((a) => !seen.has(a.articleId)),
      };
  }
};
