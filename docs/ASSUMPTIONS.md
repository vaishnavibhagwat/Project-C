# Data and calculation assumptions

Everything in this workstation runs on **simulated data**. This document lists how that data is
generated and which simplifications the risk and performance figures make, so nobody mistakes
an approximation for an institutional calculation.

Source files: `src/data/dataset.ts`, `src/data/market.ts`, `src/data/derive/*.ts`, `src/data/mock/*.ts`,
`src/utils/finance.ts`, `src/utils/time.ts`.

## 1. One shared dataset

- Built once per (seed, as-of trading day, FX rate) by `buildDataset`. The seed comes from
  `VITE_DATA_SEED` (default `20240615`). The same inputs always produce the same numbers on every
  machine.
- Every endpoint, and therefore every widget, derives from this one object plus the intraday
  tape (§3). Holdings, allocation, sector weights, heat map, treemap, attribution, alerts and the
  overview all agree. The test suite checks this.
- **As-of date**: the most recent NSE trading day whose 15:30 IST close has happened.
- **History**: 1,261 trading days (5 years plus the starting level).

## 2. Prices, NAV and benchmark

| Item                      | Assumption                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Universe                  | The 50 Nifty 50 constituents. Index weights, anchor prices, betas and idiosyncratic volatilities are approximate and illustrative, not market data.                                                                                                                                                         |
| Market factor (benchmark) | Daily return = drift + 0.92% × N(0,1), clipped to ±6%. Drift on normal days is calibrated so the benchmark compounds at about 10.5% a year.                                                                                                                                                                 |
| Drawdown event            | A 46-trading-day window starting 42% of the way through the history has drift −0.98%/day (vol 0.75%). The fund's negative returns in that window are scaled so its peak-to-trough drawdown lands at about **35%** (tests require 30–40% for several seeds).                                                 |
| Stock prices              | Geometric Brownian motion in log space: `β × log(1 + market) − ½σ²dt + σ√dt × Z`, with σ = the stock's annual idiosyncratic volatility and dt = 1/252. Each path is rescaled so the latest close equals the anchor price (a constant scale factor does not change the returns). Prices are always positive. |
| Fund NAV                  | Daily return = 0.9 × market + 0.32% × N(0,1) + α, **clamped so each day's absolute move is between 0.1% and 2%** (sign preserved). α is calibrated so the full-period Sharpe is about 0.75 (inside the 0.3–2.5 band). NAV starts at ₹100 per unit five years ago.                                           |
| Note                      | Fund NAV is a fund-level series. It is related to, but not reconstructed from, the equity holdings' prices. Intraday P&L and allocation use the holdings.                                                                                                                                                   |

## 3. Intraday tape and sessions

- **NSE hours** (IST, UTC+05:30, no DST): pre-open 09:00–09:15, continuous trading 09:15–15:30.
- During NSE hours, prices tick every `VITE_TICK_INTERVAL_MS` (default 5 s) from the previous
  close by GBM. Each tick uses its own seeded generator, so the price at a given time is the
  same in every tab and after every reload.
- Outside NSE hours, with `VITE_SIMULATE_MARKET_OPEN=true` (the default), an **extended simulated
  session** runs from 00:00 IST so the demo never freezes. The command bar still shows the real
  NSE status plus "simulated ticks". With `false`, prices are frozen at the last close.
- Per-tick volatility is the daily volatility scaled by √(1 / ticks per session).
- The first request after page load catches the tape up to "now" in slices of 1,200 ticks,
  yielding to the browser between slices.

## 4. AUM, allocation and holdings

- **AUM is exactly USD 45,000,000,000 at the last close**, converted at a fixed
  `VITE_USD_INR_RATE` (default 83.5, an assumption rather than a live rate), i.e. ₹3,75,750 Cr.
- Asset classes: Indian equity ≈ 62%, fixed income 24%, gold 5%, REITs & InvITs 3%, and cash
  as the remainder (≈ 6%). Cash absorbs share-rounding so the classes sum to AUM exactly.
- Equity sleeve: 42 of the 50 constituents (the 6 largest index names always included; 8 others
  dropped at random by seed). Weights are index weights tilted by `exp(0.35 × Z)` and capped at
  **9.5% per name** (excess redistributed pro rata). Quantities are whole shares; cost basis is
  `close × exp(−0.10 + 0.18 × Z)`.
- `Holding.weight` is the share of the equity sleeve (holdings sum to 100%). `averageCost` is the
  cost basis above; unrealised P&L is `quantity × (currentPrice − averageCost)`, derived on read.
- `Portfolio.aum` is the last-close AUM; `dailyPnL` is the intraday change in market value.
  `mtdReturn` and `ytdReturn` use NAV per unit against the last close before the month or year
  began. `sharpeRatio` is the full-period annualised Sharpe from §6 (an approximation).
- Intraday market value = holdings at live prices + non-equity classes at their close values.
  All displayed weights are recomputed from these values and sum to 100% (schema-enforced).

## 5. Trades and settlement

- 56 simulated orders per session, at seeded times **within NSE hours on trading days only**.
  They fill at the simulated price of their tick. Order sizes are ≈ ₹2–25 Cr, rounded to 25 shares.
- 28 trades from the previous session, priced at that day's close × exp(0.4% × Z).
- **Settlement is T+1** on the trading calendar (weekends and the listed holidays skipped).
  Status is Filled (settles later), Settling (settles today) or Settled.
- The NSE holiday list in `src/utils/time.ts` is approximate. It is fine for the simulation, but
  check the official NSE circulars for anything real.

## 6. Risk metrics

All metrics use simple daily returns of the simulated fund NAV and a 252-day year.

| Metric            | Formula / assumption                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Risk-free rate    | **6.75%** a year (inside the 6.5–7% band)                                                                     |
| Annualised return | mean(daily) × 252 (arithmetic)                                                                                |
| Volatility        | sample stdev(daily) × √252                                                                                    |
| Sharpe            | (annualised return − rf) ÷ volatility                                                                         |
| Sortino           | (annualised return − rf) ÷ downside deviation, where downside deviation = √(mean(min(0, r − rf/252)²)) × √252 |
| CAGR              | (last ÷ first)^(1/years) − 1                                                                                  |
| Max drawdown      | largest peak-to-trough fall of NAV; recovery = first later date at or above the prior peak                    |
| Beta              | cov(fund, benchmark) ÷ var(benchmark), daily                                                                  |
| Tracking error    | stdev(fund − benchmark) × √252                                                                                |
| Information ratio | (annualised fund return − annualised benchmark return) ÷ tracking error                                       |
| Calmar            | CAGR ÷ max drawdown                                                                                           |

## 7. Value at Risk

|                    | Assumption                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Horizon            | 1 trading day                                                                                                                            |
| Sample             | the last **252** daily fund returns, equally weighted                                                                                    |
| Historical VaR     | −(empirical quantile at 1 − confidence), linear interpolation (numpy "type 7")                                                           |
| Parametric VaR     | −(μ − z × σ) with μ, σ from the same 252 returns, assuming normal returns; z from Acklam's inverse-normal approximation (error < 1.2e-9) |
| Expected shortfall | mean of returns at or below the historical VaR threshold                                                                                 |
| Money value        | VaR fraction × AUM at the last close                                                                                                     |
| Not modelled       | position-level revaluation, liquidity horizons, fat-tail or volatility scaling, intraday positions                                       |

The VaR gauge's limit (default 2.0% of AUM) is a configurable illustrative policy value.

## 8. Sector attribution

Single-period **Brinson-Fachler** attribution of the equity sleeve against the Nifty 50:

- allocation = (w_p − w_b) × (R_b,sector − R_b,total)
- selection = w_p × (R_p,sector − R_b,sector), which includes the interaction term

Simplifications: weights are held at current values for the whole period (buy-and-hold, no
rebalancing or cash flows); benchmark weights are approximate; periods are 21, 63, 126 and 252
trading days. Effects sum exactly to active return (tests check this). This is **not** a
GIPS-compliant or multi-period linked calculation.

## 9. Alerts (rule-based)

| Type               | Rule                             | Threshold (illustrative policy)         | Related widget   |
| ------------------ | -------------------------------- | --------------------------------------- | ---------------- |
| `risk_limit`       | 1-day 99% historical VaR         | warning ≥ 1.5% of AUM, critical ≥ 2.0%  | var-gauge        |
| `risk_limit`       | NAV below high-water mark        | ≥ 5%                                    | drawdown         |
| `rebalance_signal` | Single-name weight               | ≥ 9% of the equity sleeve               | holdings-table   |
| `price_breach`     | Intraday price move              | ≥ 2.5% (warning ≥ 4%)                   | holdings-treemap |
| `news_event`       | Sample research on a held ticker | \|sentimentScore\| ≥ 0.8, newest 3 kept | research-feed    |

Alert ids are stable per rule and entity (for example `conc-RELIANCE`), so an alert keeps its id
across refreshes. The API always returns `acknowledged: false`; acknowledging is a per-user
overlay stored in DashboardStore (persisted, zod-validated) and applied on read. The earlier
T+1 settlement reminder is no longer an alert because it fits none of the four spec types;
settlement status stays visible in the trade blotter.

## 10. Research feed

One templated `NewsArticle` per 17-minute slot (40 shown), chosen by seed. Every item is
labelled as a **sample note** and the widget carries a "Sample content" banner. Items are not
real news and not investment advice. Text is sanitised (DOMPurify) and rendered as plain text.

`sentimentScore` is drawn from a band that matches the template's `sentiment` (positive
0.35..0.95, neutral −0.2..0.2, negative −0.95..−0.35). It is a seeded label for the demo, not
the output of any sentiment model. `relevantTickers` are the three largest Nifty 50 names (by
index weight) in the article's sector; a news alert is raised only when one of them is held.

## 11. REST-style mock API and generators (`src/data/mockApi.ts`, `src/data/mock/`)

A second, REST-shaped view of the **same** shared dataset (§1), for consumers that want
`GET /api/...` resources. The dashboard widgets still use `fetchEndpoint`; nothing here is
live data. Every response carries `simulated: true` and an `asOf` stamped at the as-of day's
NSE close (15:30 IST).

**Window.** The last 756 trading days (three years, 757 daily points) of the shared history.
With the default seed and an as-of day of 19 Oct 2026 (the test fixture) this runs from
25 Sep 2023 and contains the dataset's one large
drawdown: **35.3%** from 26 Oct 2023 to 6 Feb 2024, recovered on 28 Oct 2025 (dates move with
the as-of day; tests require 30–40% and a recovery).

| Item                            | Assumption                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Indian equity                   | The dataset's 42 Nifty 50 holdings (same quantities, costs and GBM prices as the widgets).                                                                                                                                                                                                                                                                                                                                                                                |
| ADR / GDR (USD)                 | Infosys, HDFC Bank (1 ADR = 3 shares), ICICI Bank (1 = 2), Wipro and Dr. Reddy's ADRs (NYSE, US); Reliance GDR (1 = 2, LSE, UK). Price = underlying close × ratio ÷ USD/INR × (1 + premium); the premium is an AR(1) around 3%, kept between −5% and +12%. Ratios are illustrative.                                                                                                                                                                                       |
| Fixed income                    | Two Government of India bonds, an HDFC Bank bond, a US Treasury and a Temasek USD note, priced per 100 face as low-volatility GBM (σ 2.5–6% a year). This is an approximation: real bond prices follow yields, coupons and pull-to-par. A 91-day T-bill takes whatever AUM is left, so the book adds up to USD 45.0B.                                                                                                                                                     |
| Derivatives                     | Nifty 50 near-month futures sized at 5% of AUM notional and **carried at 12% initial margin** (market value = margin; exposure = full notional); price = Nifty × e^(6.5% × 30/365). A 5% out-of-the-money Nifty put (hedge) and a 3% out-of-the-money Nifty Bank call, priced with Black–Scholes (45 days to expiry, 6.5% rate, volatility = 20-day realised, floored at 11–13%). Lots: Nifty 75, Nifty Bank 35. Option exposure is delta-adjusted.                       |
| Alternatives                    | Gold ETF, two Indian REITs (0.3 beta to the market factor) and a USD Singapore fund, each its own GBM.                                                                                                                                                                                                                                                                                                                                                                    |
| Mix (default seed, 19 Oct 2026) | Equity 66.7%, Fixed Income 24.2%, Derivatives 1.1%, Alternatives 8.0%; India 90.6%, US 5.9%, Singapore 2.7%, UK 0.8%.                                                                                                                                                                                                                                                                                                                                                     |
| FX                              | One USD/INR rate (`VITE_USD_INR_RATE`) for the whole window.                                                                                                                                                                                                                                                                                                                                                                                                              |
| Benchmarks                      | Nifty 50 = the dataset's market factor. Sensex = Nifty plus a 2%-a-year tracking difference. Nifty Bank / IT / Pharma = index-weighted baskets of the simulated constituents (6 banks, 5 IT, 3 pharma names). S&P 500 = its own USD GBM (μ 10%, σ 14%) with a 0.35 beta to the Nifty factor. Each ends at a round, illustrative level (e.g. Nifty 24,350); none are market quotes.                                                                                        |
| News                            | 4–7 items per trading day for the last 30 days, from Reuters, Bloomberg, Economic Times or Moneycontrol (the outlet name is a label only: these are **templated, simulated stories**, each summary says so). Each item reports a move that happened in the simulation (a holding, a sector index or the Nifty 50). Sentiment score = tanh(move ÷ 1.5%) + N(0, 0.3), clipped to ±1; positive above 0.15, negative below −0.15. News published after "now" is not returned. |
| Alerts                          | For each day, Poisson count with rate 0.4 × (fund 20-day volatility ÷ its median)^4, capped at 8. With the default seed the most volatile quarter of days averages 0.79 alerts and the calmest 0.24. Severity rises with the same ratio; alerts older than five trading days are marked acknowledged.                                                                                                                                                                     |
| Risk                            | Historical 1-day VaR / CVaR on the window's fund returns, annualised volatility, beta and tracking error vs the Nifty 50, Sharpe and Sortino (6.75% risk-free). Volatility regime compares the 20-day volatility with its median: calm < 0.8×, normal < 1.25×, elevated < 1.8×, otherwise stressed.                                                                                                                                                                       |

**Latency and failures.** Profiles are low 50 ms, normal 200 ms and high 500 ms, each varied by
up to ±20% (switch off with `jitter: false`). `failureRate` (default `VITE_MOCK_ERROR_RATE`)
makes requests fail with HTTP 503; unknown portfolios and paths answer 404; an outage gives a
`ConnectionError`.

**Validation.** Responses are serialised to JSON and parsed with zod before they are returned.
Numbers must be finite (NaN and Infinity are rejected, including NaN that JSON turned into
`null`), prices strictly positive, weights must sum to 100% and every series must have one
value per date.
