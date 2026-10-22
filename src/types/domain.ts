import type { Sector } from './data';

/**
 * Domain types from the specification. Money is in the stated currency (INR for the
 * Meridian book); percentages are in percent units (1.25 means 1.25%); timestamps are IST ISO
 * strings such as 2026-10-20T11:42:00+05:30.
 */

export type CurrencyCode = 'INR' | 'USD';

export type AssetClass = 'Equity' | 'Fixed Income' | 'Gold' | 'REITs & InvITs' | 'Cash';

export interface Portfolio {
  portfolioId: string;
  name: string;
  /** Assets under management at the last close, INR. */
  aum: number;
  /** Today's profit or loss, INR. */
  dailyPnL: number;
  /** Today's P&L as a percentage of the previous value. */
  dailyPnLPercent: number;
  /** Month-to-date return of NAV per unit, percent. */
  mtdReturn: number;
  /** Year-to-date return of NAV per unit, percent. */
  ytdReturn: number;
  /** Full-period Sharpe ratio (annualised, see docs/ASSUMPTIONS.md). */
  sharpeRatio: number;
  /** Benchmark index name. */
  benchmark: string;
  /** IST ISO timestamp of the data. */
  lastUpdated: string;
}

export interface Holding {
  holdingId: string;
  /** NSE ticker, e.g. RELIANCE. */
  ticker: string;
  name: string;
  sector: Sector;
  assetClass: AssetClass;
  quantity: number;
  /** Average purchase price per share, in `currency`. */
  averageCost: number;
  /** Latest (simulated) price per share, in `currency`. */
  currentPrice: number;
  /** quantity x currentPrice, in `currency`. */
  marketValue: number;
  /** Today's P&L, in `currency`. */
  dailyPnL: number;
  /** Today's price change, percent. */
  dailyPnLPercent: number;
  /** Share of the equity sleeve, percent (holdings sum to 100). */
  weight: number;
  currency: CurrencyCode;
}

export type Sentiment = 'positive' | 'neutral' | 'negative';

export type NewsCategory = 'earnings' | 'macro' | 'sector' | 'rating' | 'flows';

export interface NewsArticle {
  articleId: string;
  headline: string;
  summary: string;
  source: string;
  /** IST ISO timestamp. */
  publishedAt: string;
  sentiment: Sentiment;
  /** -1 (most negative) to 1 (most positive). */
  sentimentScore: number;
  /** NSE tickers the article concerns; empty for market-wide items. */
  relevantTickers: string[];
  category: NewsCategory;
}

export type AlertType = 'price_breach' | 'risk_limit' | 'news_event' | 'rebalance_signal';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  /** Stable per rule and entity, so acknowledgements survive refreshes. */
  alertId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  /** IST ISO timestamp. */
  triggeredAt: string;
  /** Registry id of the widget that shows the underlying data, e.g. var-gauge. */
  relatedWidget: string;
  /** Ticker, or PORTFOLIO for fund-level alerts. */
  relatedEntity: string;
  acknowledged: boolean;
}
