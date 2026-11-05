import { lazy } from 'react';
import { IconTrendingUp } from '@/components/Icons';
import { isEndpointData } from '@/data/api';
import { defineWidget } from '@/registry/defineWidget';
import { WidgetCategory, type WidgetDefinition } from '@/types';
import { selectQuotes, summarizeTicker } from './model';
import {
  MarketTickerConfigSchema,
  type MarketTickerConfig,
  type MarketTickerWidgetData,
} from './types';

/** Brief: refresh every 5 s; pushes on ws://mock/market/ticker refresh it in between. */
export const MARKET_TICKER_REFRESH_MS = 5000;

const symbol = (title: string) => ({ type: 'boolean' as const, title });

export const marketTickerDefinition: WidgetDefinition<MarketTickerConfig, MarketTickerWidgetData> =
  {
    id: 'market-ticker',
    name: 'Market Ticker',
    description:
      'Crawling ticker of indices, FX and commodities (simulated) with the NSE session status. Pause with the button, hover or focus; click an item for a sparkline.',
    category: WidgetCategory.FEED,
    defaultSize: { w: 6, h: 1 },
    minSize: { w: 4, h: 1 },
    maxSize: { w: 12, h: 2 },
    configSchema: {
      type: 'object',
      properties: {
        showNIFTY50: symbol('Nifty 50'),
        showSENSEX: symbol('BSE Sensex'),
        showSPX: symbol('S&P 500'),
        showFTSE: symbol('FTSE 100'),
        showUSDINR: symbol('USD/INR (fixed valuation rate)'),
        showEURUSD: symbol('EUR/USD'),
        showGOLD: symbol('Gold'),
        showCRUDE: symbol('Brent crude'),
        speed: {
          title: 'Speed',
          oneOf: [
            { const: 'slow', title: 'Slow' },
            { const: 'normal', title: 'Normal' },
            { const: 'fast', title: 'Fast' },
          ],
        },
      },
    },
    defaultConfig: {
      showNIFTY50: true,
      showSENSEX: true,
      showSPX: true,
      showFTSE: true,
      showUSDINR: true,
      showEURUSD: true,
      showGOLD: true,
      showCRUDE: true,
      speed: 'normal',
    },
    component: lazy(() => import('./index')),
    icon: IconTrendingUp,
    dataSource: {
      endpoint: 'market/ticker',
      wsChannel: 'ws://mock/market/ticker',
      refreshInterval: MARKET_TICKER_REFRESH_MS,
      latencyProfile: 'low',
    },
  };

export function summarizeMarketTicker(
  data: MarketTickerWidgetData,
  config: MarketTickerConfig,
): string {
  return summarizeTicker(selectQuotes(data, config));
}

export const marketTickerWidget = defineWidget(marketTickerDefinition, {
  configParser: MarketTickerConfigSchema,
  isData: isEndpointData('market/ticker'),
  isEmpty: (d) => d.quotes.length === 0,
  summarize: summarizeMarketTicker,
  skeleton: 'tiles',
  preload: () => import('./index'),
});
