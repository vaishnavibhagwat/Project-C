# Mock data: one seeded portfolio model

Every number in the workstation is **simulated**. None of it is market data, and none of it is
live. This document lists every assumption behind the data, in the order the numbers are built.
Calculation details for risk and attribution figures are in [ASSUMPTIONS.md](ASSUMPTIONS.md).

Source files: `src/data/dataset.ts` (market), `src/data/model.ts` (portfolio model),
`src/data/mock/instruments.ts` and `src/data/mock/benchmarks.ts` (book and index builders),
`src/data/market.ts` (intraday tape), `src/data/derive/*.ts` (widget endpoints),
`src/data/mock/responses.ts` (REST-style mock API), `src/data/controls.ts` (demo controls).

## 1. The pipeline

```text
seed + as-of date + USD/INR
  -> market (dataset.ts): trading days, Nifty 50 factor, 50 constituent price paths
  -> book (model.ts): 62 positions with quantities                 [positions]
  -> quantity x price x FX                                         [market values]
  -> value / total                                                 [weights, sum 100%]
  -> group by asset class, geography, sector                       [aggregates]
  -> book value on every past day, positions held constant         [NAV per unit]
  -> daily NAV changes                                             [returns]
  -> volatility, Sharpe, Sortino, VaR, drawdown, beta, correlation [statistics]
  -> equity holdings vs Nifty 50 by sector                         [attribution]
```

There is **one** model object per (seed, as-of trading day, FX rate). The dashboard's widget
endpoints, the Portfolio Summary Strip, the REST-style mock API (`mockApi.ts`), the TanStack
Query hooks (`queries.ts`) and the simulated WebSocket all read it. Nothing is randomised per
widget. `src/__tests__/model-consistency.test.ts` checks that the numbers agree. It covers
weights summing to 100%, the strip matching the holdings table, risk figures matching the
model, and the mock API serving the same book.

## 2. Inputs

| Input            | Default                                                                  | Where                     |
| ---------------- | ------------------------------------------------------------------------ | ------------------------- |
| Seed             | `20240615`                                                               | `VITE_DATA_SEED`          |
| USD/INR          | 83.5, fixed (an assumption, not a live rate)                             | `VITE_USD_INR_RATE`       |
| AUM              | USD 45,000,000,000 = ₹3,75,750 Cr at 83.5                                | `AUM_USD` in `dataset.ts` |
| As-of date       | the latest NSE trading day whose 15:30 IST close has passed              | `lastCompletedTradingDay` |
| History          | 1,261 trading days (five years plus the starting point)                  | `HISTORY_DAYS`            |
| Risk-free rate   | 6.75% a year                                                             | `RISK_FREE_RATE`          |
| Trading calendar | NSE weekdays minus listed holidays; IST (UTC+05:30); session 09:15–15:30 | `src/utils/time.ts`       |

## 3. Market (`dataset.ts`)

| Item            | Assumption                                                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nifty 50 factor | Daily return = drift + 0.92% × N(0,1), clipped to ±6%. Normal-day drift is calibrated so the index compounds at about **10.5% a year**.                                                                                                                        |
| Crash window    | 46 trading days starting 42% into the history, with daily drift −0.98% × _crash scale_ and volatility 0.75%. The model sets the crash scale (§6).                                                                                                              |
| Stocks          | GBM in log space: `β × ln(1 + market) + α − ½σ²dt + σ√dt × Z`. σ is the stock's idiosyncratic volatility, dt = 1/252. α is 0, except for held names (§6). Each path is rescaled so the last close equals the stock's anchor price. Prices are always positive. |
| Universe        | The 50 Nifty 50 constituents. Index weights, anchor prices, betas and volatilities are approximate and illustrative.                                                                                                                                           |
| Determinism     | Every normal draw is fixed by the seed and as-of date before calibration, so rebuilding with new parameters reuses the same shocks.                                                                                                                            |

## 4. The book (62 positions)

| Sleeve              | Positions                                                                          | Sizing                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Indian equity (NSE) | 42 Nifty 50 stocks: the 6 largest index names plus 36 others (8 dropped by seed)   | 62% of AUM. Weights are index weights × exp(0.35 Z), capped at 9.5% per name; whole shares at the latest close                    |
| Depositary receipts | Infosys, HDFC Bank, ICICI Bank, Wipro and Dr. Reddy's ADRs (US); Reliance GDR (UK) | Target weights 0.4–1.2% each. Price = underlying × ratio ÷ USD/INR × (1 + premium), with the premium following an AR(1) around 3% |
| Fixed income        | GOI 2033 and 2034, HDFC Bank 2033 bond, UST 2034, Temasek 2035                     | Target weights 1.2–8%                                                                                                             |
| Derivatives         | Nifty 50 futures, a Nifty 5% OTM put, a Nifty Bank 3% OTM call                     | Futures 5% of AUM notional, carried at 12% margin; options at 0.35% and 0.15%                                                     |
| Alternatives        | Gold BeES ETF, Embassy and Mindspace REITs, a Singapore feeder fund (USD)          | 4%, 1.4%, 1.1% and 1.5%                                                                                                           |
| Money market        | 91-day T-bill plus INR cash                                                        | Cash is 0.5% of AUM. The T-bill takes the rest, so the book totals AUM to within ₹1                                               |

**Measured mix** (default seed, as-of 4 Nov 2026): Equity ≈ 66.7%, Fixed Income ≈ 24.2%,
Derivatives ≈ 1.1% (margin and premiums), Alternatives ≈ 8.0%. By geography: India ≈ 90.6%,
US ≈ 5.9%, Singapore ≈ 2.7%, UK ≈ 0.8%.

Price paths:

- **Bonds and the T-bill** are _total-return_ prices. The drift is the coupon or yield (for
  example 7.18% for GOI 2033 and 6.5% for the T-bill), so interest accrues in the price. There
  are no separate coupon cash flows.
- **Options** are positions rolled at constant moneyness and tenor. Each day is priced with
  Black–Scholes at the same distance from spot as today's strike, 45 days to expiry, a 6.5%
  rate, and that day's 20-day realised volatility (floored at 11% for Nifty and 13% for Nifty
  Bank). The last close is today's option.
- **Futures** are priced as Nifty × e^(6.5% × 30/365).
- **Funds and REITs** follow GBMs with a small beta to the market.
- **USD positions** convert at the fixed USD/INR rate on every day. There is no FX risk.

Average cost is the latest close × exp(bias + spread × Z), set by the seed.

## 5. Valuation, weights and aggregates (`valueBook`)

- **Market value** (INR) = value at the last close + quantity × (price now − last close) × FX.
  For everything except futures this equals quantity × price × FX. A futures position is worth
  its margin plus today's variation margin.
- **During NSE hours** (and the extended simulated session) the 42 NSE stocks tick on the
  intraday tape. Everything else is held at its last close: there are no intraday prices for
  bonds, funds, derivatives or overseas listings.
- **When the market is frozen**, every position shows the as-of day's move against the previous
  close.
- **Daily P&L** = quantity × (price − previous close) × FX. Futures P&L is on the full notional.
- **Unrealised P&L** = quantity × (price − average cost) × FX; the **cost basis** is quantity ×
  average cost × FX.
- **Weight** = market value ÷ the book's total market value. All 62 positions sum to 100%.
- **Aggregates** sum market values by asset class, geography or sector. Sector allocation covers
  the Equity class (NSE stocks plus depositary receipts, by the underlying's sector).
- **Totals.** The summary's market value and day P&L are sums over the same rows as the holdings
  table, so the strip and the table always agree. At the last close the book totals AUM;
  intraday it moves by today's P&L.

## 6. NAV, returns and calibration

- **Book value on day t** = today's value − Σ quantity × (price today − price on day t) × FX.
  This holds today's positions back through the history (buy-and-hold, no trades or flows);
  futures P&L settles through cash.
- **NAV per unit** = book value scaled to ₹100 on the first day. **Daily return** = the NAV's
  day-on-day change. This is the only NAV series. The NAV chart, drawdown, VaR, Sharpe, the
  summary strip and the mock API all use it.
- **Calibration.** The model rebuilds the market a few times (usually 3–4) with the same shocks
  and adjusts two levers until the NAV _derived from the holdings_ lands near its targets:
  - The **crash scale** deepens or softens the crash window until the maximum drawdown is
    about **35%**.
  - A **selection alpha** (log drift on held stocks only) is set until the full-period Sharpe
    is about **0.6**, inside the brief's 0.3–2.5 band.

**Measured results** (default seed, as-of 4 Nov 2026; tests check five seeds):

| Measure                        | Value                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Maximum drawdown               | 34.7%: peak 16 Nov 2023, trough 31 Jan 2024 (51 trading days down), recovered 19 Feb 2026 (508 trading days to recover) |
| Sharpe, full period            | 0.60 (Sortino 0.88)                                                                                                     |
| CAGR / volatility              | 13.2% / 10.3% a year                                                                                                    |
| Beta to Nifty 50 / correlation | 0.64 / 0.96 (daily returns; correlation over the last 252 days)                                                         |
| VaR, 1 day, last 252 days      | historical 0.89% (95%) and 1.28% (99%); parametric 0.96% and 1.41%                                                      |
| Calibration levers             | crash scale 1.41; selection alpha ≈ 7.0% a year on held names                                                           |
| Nifty 50 over the same history | about 10.5% a year, with a ≈ 50% fall in the crash window                                                               |

Things to know:

- **Crash depth.** Two-thirds of the book is equity, and bonds, gold and cash barely fall.
  The simulated Nifty therefore has to fall about 50% for the fund to fall 35%. That is deeper
  than any recent Nifty 50 drawdown, and it is a property of the simulation.
- **Selection alpha** is a modelling lever, not a skill estimate. It is why sector attribution
  shows positive selection.
- **Daily moves.** NAV moves are not clamped, because they come from the holdings. On the
  default seed, 87.6% of days move between 0.1% and 2%, 153 of 1,260 days move less than 0.1%,
  3 days move more than 2%, and the largest move is 2.9%. Tests require at least 85% of days
  inside the 0.1–2% band and no day beyond 5%, for five seeds. Earlier builds clamped a
  separately generated fund series into 0.1–2%; that series no longer exists.

## 7. Benchmarks

- **Nifty 50** is the market factor.
- **Sensex** = Nifty plus a 2%-a-year tracking difference.
- **Nifty Bank, Nifty IT and Nifty Pharma** are index-weighted baskets of the simulated
  constituents.
- **S&P 500** is its own USD GBM (μ 10%, σ 14%) with a 0.35 beta to the Nifty factor.
- Each index ends at a round, illustrative level (e.g. Nifty 24,350). None are market quotes.
- The `performance/benchmarks` endpoint serves the fund NAV and all six series over the full
  history, on the same trading days. S&P 500 levels are in USD; with the fixed FX rate its
  returns are the same in INR.
- **Custom blend** (Performance vs Benchmarks widget): a chosen share in the Nifty 50 and the
  rest in the S&P 500, rebalanced daily (the blend's daily return is the weighted sum of the two).

## 8. Intraday tape, trades, research and alerts

These are unchanged; see ASSUMPTIONS.md §3, §5, §9, §10 and §11.

- **Intraday tape:** prices tick from the last close by GBM every `VITE_TICK_INTERVAL_MS`,
  seeded by time.
- **Trades:** blotter trades are in the 42 NSE holdings.
- **Alerts:** VaR and drawdown alerts quote the model's statistics. Concentration alerts use a
  stock's share of the Equity class. Price alerts use the day's move.
- **Mock API news and alerts** come from the model's last three years of positions and
  benchmarks.

## 9. REST-style mock API

`mockApi.ts` serves the model's book **at the last close**. Its holdings are the same 62
positions with the same quantities and prices, its NAV is the model's NAV over the last three
years, and its benchmarks are the model's. The dashboard's widget endpoints add live intraday
marks on top.

## 10. Demo controls (`src/data/controls.ts`)

| Control                     | Where                                      | Effect                                                                                                                                                                            |
| --------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pause / Resume live updates | Command bar button, Developer menu         | Stops polling and ignores socket pushes. Widgets keep their last data and turn stale (amber) after 2× their refresh interval. A banner offers Resume, which refreshes everything. |
| Latency profile             | Developer menu: Auto / Low / Normal / High | Overrides every request's profile: base latency × 0.4, 1 or 2.5 for widget endpoints; 50 / 200 / 500 ms for the mock API. Auto keeps each widget's own profile.                   |
| Simulate failure            | Developer menu                             | Every request fails with a simulated HTTP 503. Widgets show an error with Retry, or keep their last data and turn stale.                                                          |
| Simulate disconnect         | Developer menu (also the Feed menu)        | The data feed goes offline. Widgets show the disconnected state, and the real-time socket falls back and retries.                                                                 |

None of these are persisted; a reload resets them.
