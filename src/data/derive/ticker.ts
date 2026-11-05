import { MACRO_SPECS, macroSeries } from '../mock/macro';
import type { MarketTickerData } from '../schemas';
import { asOfIso, round, type DeriveContext } from './context';

/** Daily closes kept for each sparkline (plus today's value). */
export const TICKER_HISTORY_DAYS = 30;

type Quote = MarketTickerData['quotes'][number];

/**
 * market/ticker: the ticker's instruments. Nifty 50 and Sensex move with the simulated NSE tape
 * during the session; S&P 500, FTSE 100, EUR/USD, gold and crude show their last simulated
 * close; USD/INR is the fixed rate the book is valued at (VITE_USD_INR_RATE).
 */
export function deriveTicker(ctx: DeriveContext): MarketTickerData {
  const { dataset, market } = ctx;
  const live = market.mode !== 'frozen';
  const tail = (xs: readonly number[]) => xs.slice(-TICKER_HISTORY_DAYS);

  const quote = (
    symbol: string,
    name: string,
    closes: readonly number[],
    decimals: number,
    intraday: number | null,
    note: string,
  ): Quote => {
    const last = closes[closes.length - 1] ?? 0;
    const prior = closes[closes.length - 2] ?? last;
    // Rounded first, so the % shown matches the prices shown.
    const price = round(intraday === null ? last : last * (1 + intraday), decimals);
    const previousClose = round(intraday === null ? prior : last, decimals);
    return {
      symbol,
      name,
      price,
      previousClose,
      changePct: round(previousClose > 0 ? (price / previousClose - 1) * 100 : 0, 4),
      decimals,
      live: intraday !== null,
      note,
      // Daily closes, plus today's live value while the tape is running.
      history: [...tail(closes), ...(intraday === null ? [] : [price])].map((v) =>
        round(v, decimals),
      ),
    };
  };

  const bench = (id: string) => dataset.benchmarks.find((b) => b.id === id)?.levels ?? [];
  const nseMove = live ? market.benchmarkChange : null;
  const macro = macroSeries(dataset);
  const macroQuote = (id: (typeof MACRO_SPECS)[number]['id']) => {
    const spec = MACRO_SPECS.find((m) => m.id === id);
    return quote(
      id,
      spec?.name ?? id,
      macro[id],
      spec?.decimals ?? 2,
      null,
      'Last simulated close',
    );
  };
  const fx = dataset.fxUsdInr;

  const quotes: Quote[] = [
    quote(
      'NIFTY50',
      'Nifty 50',
      bench('NIFTY50'),
      2,
      nseMove,
      live ? 'Live simulated tape' : 'Last close',
    ),
    quote(
      'SENSEX',
      'BSE Sensex',
      bench('SENSEX'),
      2,
      nseMove,
      live ? 'Live simulated tape' : 'Last close',
    ),
    quote('SPX', 'S&P 500', bench('SPX'), 2, null, 'Last simulated close'),
    macroQuote('FTSE'),
    {
      symbol: 'USDINR',
      name: 'USD/INR',
      price: fx,
      previousClose: fx,
      changePct: 0,
      decimals: 2,
      live: false,
      note: 'Fixed valuation rate (VITE_USD_INR_RATE)',
      history: new Array<number>(TICKER_HISTORY_DAYS).fill(fx),
    },
    macroQuote('EURUSD'),
    macroQuote('GOLD'),
    macroQuote('CRUDE'),
  ];
  return { asOf: asOfIso(ctx), simulated: true, quotes };
}
