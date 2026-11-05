# Data and calculation assumptions

Everything in this workstation runs on **simulated data**. This document lists how that data is
generated and which simplifications the risk and performance figures make, so nobody mistakes
an approximation for an institutional calculation.

**Data assumptions** (the market, the book, valuation, NAV derivation and calibration) are in
[mock-data.md](mock-data.md). This document keeps the calculation and feed details.

Source files: `src/data/dataset.ts`, `src/data/model.ts`, `src/data/market.ts`, `src/data/derive/*.ts`, `src/data/mock/*.ts`,
`src/utils/finance.ts`, `src/utils/time.ts`.

## 1. One portfolio model

- `buildPortfolioModel` (`src/data/model.ts`) builds one book of 62 positions on one seeded
  market (`src/data/dataset.ts`) per (seed, as-of trading day, FX rate). Every endpoint,
  widget, the summary strip, the mock API and the WebSocket simulator read it. Same inputs, same
  numbers on every machine. Details: [mock-data.md](mock-data.md) §1–§2.
- **As-of date**: the most recent NSE trading day whose 15:30 IST close has happened.
- **History**: 1,261 trading days (5 years plus the starting level).

## 2. Prices, NAV and benchmark

- Market factor, stock GBM and crash window: [mock-data.md](mock-data.md) §3.
- **NAV is derived from the holdings**: the book's value on each past day with today's
  positions held constant, scaled to ₹100 at the start ([mock-data.md](mock-data.md) §6).
  The model calibrates the crash depth and a selection alpha on held stocks so that NAV has one
  drawdown of about 35% and a Sharpe ratio of about 0.6. Tests require a 30–40% drawdown that
  recovers, and a Sharpe inside 0.3–2.5, for five seeds.
- Daily NAV moves are not clamped. Tests require at least 85% of days to move between 0.1% and
  2%, and no day beyond 5%.

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

- **AUM is USD 45,000,000,000 at the last close** (₹3,75,750 Cr at the fixed
  `VITE_USD_INR_RATE` of 83.5, an assumption rather than a live rate). The 62 positions add up
  to it to within ₹1.
- Asset classes are Equity, Fixed Income, Derivatives and Alternatives. Geographies are India,
  US, UK and Singapore. The book and its measured mix: [mock-data.md](mock-data.md) §4.
- `Holding.weight` is the share of the **whole book** (all holdings sum to 100%).
  `marketValue`, `dailyPnL`, `unrealisedPnL` and `costBasis` are in INR; `currentPrice` and
  `averageCost` are in the holding's own currency.
- `Portfolio.aum` is the last-close AUM. `dailyPnL` is the sum of the holdings' day P&L, so the
  summary strip and the holdings table always agree. `mtdReturn` and `ytdReturn` use NAV per unit
  against the last close before the month or year began. `sharpeRatio` is the full-period
  annualised Sharpe of the derived NAV (an approximation).
- Intraday, NSE stocks tick and everything else is held at its last close. All displayed
  weights are recomputed from these values and sum to 100% (schema-enforced).

## 5. Trades and settlement

- 56 simulated orders per session, at seeded times **within NSE hours on trading days only**.
  They fill at the simulated price of their tick. Order sizes are ≈ ₹2–25 Cr, rounded to 25 shares.
- 28 trades from the previous session, priced at that day's close × exp(0.4% × Z).
- **Settlement is T+1** on the trading calendar (weekends and the listed holidays skipped).
  Status is Filled (settles later), Settling (settles today) or Settled.
- The NSE holiday list in `src/utils/time.ts` is approximate. It is fine for the simulation, but
  check the official NSE circulars for anything real.

## 6. Risk metrics

All metrics use simple daily returns of the NAV derived from the holdings and a 252-day year.

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

A second, REST-shaped view of the **same** portfolio model (§1), for consumers that want
`GET /api/...` resources. It serves the model's positions, NAV and benchmarks at the last close
(no intraday marks). The dashboard widgets still use `fetchEndpoint`; nothing here is
live data. Every response carries `simulated: true` and an `asOf` stamped at the as-of day's
NSE close (15:30 IST).

**Window.** The last 756 trading days (three years, 757 daily points) of the shared history.
It contains the model's one large drawdown (with the default seed and an as-of day of
4 Nov 2026: **34.7%** from 16 Nov 2023 to 31 Jan 2024, recovered on 19 Feb 2026; dates move with
the as-of day; tests require 30–40% and a recovery).

| Item                           | Assumption                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Book                           | The portfolio model's 62 positions, unchanged (same ids, quantities, costs and prices as the widgets); see mock-data.md §4.                                                                                                                                                                                                                                                                                                                                                               |
| ADR / GDR (USD)                | Infosys, HDFC Bank (1 ADR = 3 shares), ICICI Bank (1 = 2), Wipro and Dr. Reddy's ADRs (NYSE, US); Reliance GDR (1 = 2, LSE, UK). Price = underlying close × ratio ÷ USD/INR × (1 + premium); the premium is an AR(1) around 3%, kept between −5% and +12%. Ratios are illustrative.                                                                                                                                                                                                       |
| Fixed income                   | Two Government of India bonds, an HDFC Bank bond, a US Treasury and a Temasek USD note as total-return prices per 100 face (drift = coupon, σ 2.5–6% a year). An approximation: real bond prices follow yields and pull to par. A T-bill and 0.5% cash take the rest of AUM.                                                                                                                                                                                                              |
| Derivatives                    | Nifty 50 near-month futures sized at 5% of AUM notional and **carried at 12% initial margin** (market value = margin; exposure = full notional); price = Nifty × e^(6.5% × 30/365). A 5% out-of-the-money Nifty put (hedge) and a 3% out-of-the-money Nifty Bank call, priced with Black–Scholes (45 days to expiry, 6.5% rate, volatility = 20-day realised, floored at 11–13%; history rolled at constant moneyness). Lots: Nifty 75, Nifty Bank 35. Option exposure is delta-adjusted. |
| Alternatives                   | Gold ETF, two Indian REITs (0.3 beta to the market factor) and a USD Singapore fund, each its own GBM.                                                                                                                                                                                                                                                                                                                                                                                    |
| Mix (default seed, 4 Nov 2026) | Equity ≈ 66.7%, Fixed Income ≈ 24.2%, Derivatives ≈ 1.1%, Alternatives ≈ 8.0%; India ≈ 90.6%, US ≈ 5.9%, Singapore ≈ 2.7%, UK ≈ 0.8%.                                                                                                                                                                                                                                                                                                                                                     |
| FX                             | One USD/INR rate (`VITE_USD_INR_RATE`) for the whole window.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Benchmarks                     | Nifty 50 = the dataset's market factor. Sensex = Nifty plus a 2%-a-year tracking difference. Nifty Bank / IT / Pharma = index-weighted baskets of the simulated constituents (6 banks, 5 IT, 3 pharma names). S&P 500 = its own USD GBM (μ 10%, σ 14%) with a 0.35 beta to the Nifty factor. Each ends at a round, illustrative level (e.g. Nifty 24,350); none are market quotes.                                                                                                        |
| News                           | 4–7 items per trading day for the last 30 days, from Reuters, Bloomberg, Economic Times or Moneycontrol (the outlet name is a label only: these are **templated, simulated stories**, each summary says so). Each item reports a move that happened in the simulation (a holding, a sector index or the Nifty 50). Sentiment score = tanh(move ÷ 1.5%) + N(0, 0.3), clipped to ±1; positive above 0.15, negative below −0.15. News published after "now" is not returned.                 |
| Alerts                         | For each day, Poisson count with rate 0.4 × (fund 20-day volatility ÷ its median)^4, capped at 8. With the default seed the most volatile quarter of days averages 0.79 alerts and the calmest 0.24. Severity rises with the same ratio; alerts older than five trading days are marked acknowledged.                                                                                                                                                                                     |
| Risk                           | Historical 1-day VaR / CVaR on the window's fund returns, annualised volatility, beta and tracking error vs the Nifty 50, Sharpe and Sortino (6.75% risk-free). Volatility regime compares the 20-day volatility with its median: calm < 0.8×, normal < 1.25×, elevated < 1.8×, otherwise stressed.                                                                                                                                                                                       |

**Latency and failures.** Profiles are low 50 ms, normal 200 ms and high 500 ms, each varied by
up to ±20% (switch off with `jitter: false`). `failureRate` (default `VITE_MOCK_ERROR_RATE`)
makes requests fail with HTTP 503; unknown portfolios and paths answer 404; an outage gives a
`ConnectionError`.

**Validation.** Responses are serialised to JSON and parsed with zod before they are returned.
Numbers must be finite (NaN and Infinity are rejected, including NaN that JSON turned into
`null`), prices strictly positive, weights must sum to 100% and every series must have one
value per date.

## 12. Simulated WebSocket (`src/data/wsSimulator.ts`)

No socket is opened. Messages are produced in the browser on a timer from the same dataset and
intraday tape the API uses, so a pushed price equals the polled price at that moment. Latency is
a fixed delay (default 80 ms, configurable 0–5000 ms). Alert and news channels send only items
not sent before (the first message after subscribing carries the current set), so an empty
message is a heartbeat. A simulated disconnect lasts 20 s by default (until switched off from
the Feed menu); reconnect attempts follow 1, 2, 4, 8, 16 s and then every 16 s. Pushes refresh
the affected endpoints by refetching them, so the dashboard shows the same validated payloads
whether data arrives by push or by polling.

## 13. Finance formulas, query hooks and transformers

Formulas in `src/utils/finance.ts` (textbook definitions on simulated data; approximations):

| Measure      | Definition                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Returns      | simple r = P_t / P_t−1 − 1; log r = ln(P_t / P_t−1); cumulative = ∏(1 + r) − 1                                                                                                                            |
| Volatility   | sample standard deviation (n − 1) of daily returns × √252                                                                                                                                                 |
| Sharpe       | (mean daily return × 252 − risk-free rate) / annualised volatility; 0 if volatility is 0                                                                                                                  |
| Max drawdown | largest fall from a running peak; decline = peak → trough, recovery period = trough → first close at or above the old peak, under water = peak → recovery (all in trading days; null while not recovered) |
| VaR          | as §7: 1-day, historical (interpolated quantile) and parametric (normal, μ − zσ) at 95% and 99%                                                                                                           |
| Correlation  | Pearson correlation of daily returns over the common length; 0 when a series is flat; matrix is symmetric with 1 on the diagonal                                                                          |
| Brinson      | allocation (w_p − w_b)(r_b − R_b) (Brinson-Fachler; BHB uses (w_p − w_b) r_b), selection w_b (r_p − r_b), interaction (w_p − w_b)(r_p − r_b). Single period, no cash flows, no multi-period linking       |

The sector-attribution widget (§8) still reports interaction inside selection; the general
`brinsonAttribution` function reports it separately.

`toPerformanceStats` recomputes statistics from the API's daily NAV (VaR over the last 252
returns). Values can differ slightly from the API's own risk response, which is computed from
the same data with rounding applied at different points.

The query hooks treat data as stale for display after 2× the refresh interval, the same rule
as the widget frame. Streamed alerts carry no volatility reading, so a merged alert takes the
response's current volatility. The news stream carries in-house research notes; when merged
into the market news response they get the source "Meridian Research" and no price move.

## 14. Performance vs Benchmarks widget

- Every line is rebased to 100 on the first visible trading day, so the value at the cursor
  minus 100 is the return since then. Zoom, pan and the brush all re-base.
- Presets end on the last trading day and start on the last close on or before the same
  calendar date one period earlier (1W = 7 calendar days). YTD starts on the last close of
  the previous year, so its end value is the year-to-date return.
- Log scale plots the same rebased values on a logarithmic axis: equal heights are equal
  percentage moves.
- The custom benchmark is an approximation of a daily-rebalanced blend (no costs, fixed FX).

## 15. Sector Heat Map widget

- Cells are sized by market value (INR) and coloured by day P&L %, where P&L % = day P&L ÷
  (market value − day P&L), i.e. against the previous close value. A sector's figure sums its
  holdings' values and P&L before dividing, so it is value-weighted.
- Default scope is the equity asset class; "whole book" groups non-equity holdings by asset
  class. Intraday, only NSE stocks tick, so ADRs, GDRs and non-equity holdings show 0.00%
  (held at the last close) during the session.
- Colour strength grows linearly with |P&L %| and is full at the configured cap (default 2%).
  Green / red uses the theme's positive and negative colours; blue / orange uses Series 5 and
  Series 3, which are blue and amber in every built-in theme. Every cell also shows ▲, ▼ or ■.
