import type { Sector } from '@/types';

export interface Constituent {
  symbol: string;
  name: string;
  sector: Sector;
  /** Approximate index weight in %, normalised to 100 at load time. Illustrative only. */
  indexWeight: number;
  /** Anchor price in INR for the latest close. Illustrative, not a market quote. */
  anchorPrice: number;
  /** Beta to the simulated market factor. */
  beta: number;
  /** Annualised idiosyncratic volatility. */
  idioVol: number;
}

type Row = [string, string, Sector, number, number, number, number];

/** Nifty 50 constituents. Weights and prices are approximate and for simulation only. */
const ROWS: Row[] = [
  ['HDFCBANK', 'HDFC Bank', 'Financial Services', 13.1, 1712, 0.95, 0.16],
  ['ICICIBANK', 'ICICI Bank', 'Financial Services', 8.9, 1288, 1.05, 0.18],
  ['RELIANCE', 'Reliance Industries', 'Oil, Gas & Fuels', 8.4, 2876, 1.0, 0.17],
  ['INFY', 'Infosys', 'Information Technology', 5.6, 1835, 0.85, 0.2],
  ['BHARTIARTL', 'Bharti Airtel', 'Telecommunication', 4.6, 1642, 0.8, 0.19],
  ['ITC', 'ITC', 'FMCG', 3.9, 472, 0.65, 0.16],
  ['LT', 'Larsen & Toubro', 'Construction Materials', 3.8, 3612, 1.1, 0.2],
  ['TCS', 'Tata Consultancy Services', 'Information Technology', 3.5, 4105, 0.8, 0.18],
  ['AXISBANK', 'Axis Bank', 'Financial Services', 3.0, 1176, 1.15, 0.22],
  ['KOTAKBANK', 'Kotak Mahindra Bank', 'Financial Services', 2.9, 1796, 0.95, 0.2],
  ['SBIN', 'State Bank of India', 'Financial Services', 2.8, 812, 1.2, 0.24],
  ['M&M', 'Mahindra & Mahindra', 'Automobile', 2.5, 2934, 1.1, 0.24],
  ['HINDUNILVR', 'Hindustan Unilever', 'FMCG', 2.0, 2418, 0.6, 0.16],
  ['BAJFINANCE', 'Bajaj Finance', 'Financial Services', 2.0, 7020, 1.25, 0.26],
  ['SUNPHARMA', 'Sun Pharmaceutical', 'Healthcare', 1.7, 1745, 0.7, 0.2],
  ['HCLTECH', 'HCL Technologies', 'Information Technology', 1.7, 1620, 0.85, 0.2],
  ['MARUTI', 'Maruti Suzuki', 'Automobile', 1.6, 12450, 0.95, 0.2],
  ['NTPC', 'NTPC', 'Power', 1.5, 352, 0.9, 0.22],
  ['ETERNAL', 'Eternal', 'Consumer Services', 1.5, 248, 1.35, 0.38],
  ['TITAN', 'Titan Company', 'Consumer Durables', 1.4, 3380, 1.0, 0.22],
  ['TATAMOTORS', 'Tata Motors', 'Automobile', 1.4, 742, 1.35, 0.32],
  ['ULTRACEMCO', 'UltraTech Cement', 'Construction Materials', 1.3, 11380, 0.95, 0.2],
  ['POWERGRID', 'Power Grid Corporation', 'Power', 1.3, 308, 0.75, 0.2],
  ['BEL', 'Bharat Electronics', 'Capital Goods', 1.2, 386, 1.2, 0.32],
  ['TATASTEEL', 'Tata Steel', 'Metals & Mining', 1.1, 152, 1.4, 0.3],
  ['TRENT', 'Trent', 'Consumer Services', 1.1, 5420, 1.2, 0.34],
  ['ADANIPORTS', 'Adani Ports & SEZ', 'Capital Goods', 1.0, 1396, 1.3, 0.3],
  ['ASIANPAINT', 'Asian Paints', 'Consumer Durables', 1.0, 2390, 0.75, 0.2],
  ['BAJAJFINSV', 'Bajaj Finserv', 'Financial Services', 1.0, 1958, 1.15, 0.24],
  ['JSWSTEEL', 'JSW Steel', 'Metals & Mining', 0.95, 1028, 1.3, 0.27],
  ['HINDALCO', 'Hindalco Industries', 'Metals & Mining', 0.95, 682, 1.35, 0.28],
  ['NESTLEIND', 'Nestle India', 'FMCG', 0.9, 2365, 0.55, 0.15],
  ['GRASIM', 'Grasim Industries', 'Construction Materials', 0.9, 2712, 1.0, 0.22],
  ['TECHM', 'Tech Mahindra', 'Information Technology', 0.9, 1584, 0.95, 0.24],
  ['ONGC', 'Oil & Natural Gas Corporation', 'Oil, Gas & Fuels', 0.9, 258, 1.05, 0.26],
  ['COALINDIA', 'Coal India', 'Oil, Gas & Fuels', 0.85, 396, 0.9, 0.25],
  ['SHRIRAMFIN', 'Shriram Finance', 'Financial Services', 0.85, 642, 1.3, 0.3],
  ['CIPLA', 'Cipla', 'Healthcare', 0.8, 1512, 0.65, 0.2],
  ['WIPRO', 'Wipro', 'Information Technology', 0.75, 262, 0.85, 0.22],
  ['JIOFIN', 'Jio Financial Services', 'Financial Services', 0.75, 318, 1.25, 0.34],
  ['TATACONSUM', 'Tata Consumer Products', 'FMCG', 0.7, 1092, 0.7, 0.2],
  ['SBILIFE', 'SBI Life Insurance', 'Financial Services', 0.7, 1784, 0.8, 0.2],
  ['HDFCLIFE', 'HDFC Life Insurance', 'Financial Services', 0.7, 742, 0.8, 0.21],
  ['DRREDDY', "Dr. Reddy's Laboratories", 'Healthcare', 0.65, 1268, 0.6, 0.2],
  ['APOLLOHOSP', 'Apollo Hospitals', 'Healthcare', 0.65, 7186, 0.85, 0.24],
  ['BAJAJ-AUTO', 'Bajaj Auto', 'Automobile', 0.65, 8540, 0.95, 0.22],
  ['EICHERMOT', 'Eicher Motors', 'Automobile', 0.6, 5480, 1.0, 0.24],
  ['ADANIENT', 'Adani Enterprises', 'Metals & Mining', 0.6, 2412, 1.5, 0.4],
  ['INDUSINDBK', 'IndusInd Bank', 'Financial Services', 0.5, 812, 1.35, 0.34],
  ['HEROMOTOCO', 'Hero MotoCorp', 'Automobile', 0.5, 4380, 0.9, 0.24],
];

const totalWeight = ROWS.reduce((sum, row) => sum + row[3], 0);

export const NIFTY50: readonly Constituent[] = ROWS.map(
  ([symbol, name, sector, weight, anchorPrice, beta, idioVol]) => ({
    symbol,
    name,
    sector,
    indexWeight: (weight / totalWeight) * 100,
    anchorPrice,
    beta,
    idioVol,
  }),
);

export const SECTORS: readonly Sector[] = Array.from(new Set(NIFTY50.map((c) => c.sector)));

export function findConstituent(symbol: string): Constituent | undefined {
  return NIFTY50.find((c) => c.symbol === symbol);
}
