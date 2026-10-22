# Meridian Capital · Portfolio Intelligence

> See the risk. Understand the return. Act with conviction.

An institutional portfolio analytics workstation for **Meridian Capital**, a fictional Mumbai-based
asset manager with **USD 45.0B AUM**. It is a configurable, drag-and-drop widget grid over one
shared, seeded, simulated dataset (Nifty 50 equities, INR with USD where relevant, IST, NSE hours,
T+1 settlement).

**Every number on screen is simulated.** The command bar shows a permanent `SIMULATED DATA` label,
research items are marked as sample content, and nothing here is live market data or advice.

Built for the ZeTheta FED assessment.

---

## Quick start

```bash
npm install                 # also installs the husky pre-commit hook
cp .env.example .env        # all runtime configuration lives here
npm run dev                 # http://localhost:5173
```

| Script                    | What it does                                                       |
| ------------------------- | ------------------------------------------------------------------ |
| `npm run dev`             | Vite dev server                                                    |
| `npm run build`           | Type-check (`tsc`, strict) then production build to `dist/`        |
| `npm run preview`         | Serve the production build                                         |
| `npm run test`            | Vitest + React Testing Library (247 tests)                         |
| `npm run test:coverage`   | Tests with v8 coverage (text + HTML report in `coverage/`)         |
| `npm run lint`            | ESLint with `typescript-eslint` `recommended-type-checked`         |
| `npm run format`          | Prettier `--write` (`printWidth` 100, `singleQuote`)               |
| `npm run format:check`    | Prettier (`printWidth` 100, `singleQuote`)                         |
| `npm run storybook`       | Storybook 8 on http://localhost:6006                               |
| `npm run build-storybook` | Static Storybook in `storybook-static/`                            |
| `npm run analyze`         | Gzip size report for `dist/`; fails if a bundle budget is exceeded |
| `npm run story-coverage`  | Share of production components with a story; fails below 90%       |
| `npm run check`           | Type-check, lint, format check and tests in one go                 |

On every commit, husky runs **lint-staged**: `eslint --fix` and `prettier --write` on the staged
files, and the commit stops on any lint error.

`python scripts/measure-perf.py` measures runtime performance in headless Chrome (needs
Python Playwright; see [docs/PERFORMANCE.md](docs/PERFORMANCE.md)).

## What's in it

**Six app areas** (slim icon rail, hash-routed so every page is deep-linkable):

| Area                              | Default widgets                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Portfolio Workstation (`G 1`)     | 10 widgets: overview, NAV, allocation, VaR, holdings, alerts, heat map, treemap, drawdown, research |
| Risk Analytics (`G 2`)            | Risk-adjusted metrics, VaR gauge, drawdown, sector heat map, limit alerts                           |
| Holdings Explorer (`G 3`)         | Holdings table, treemap, allocation, trade blotter                                                  |
| Performance & Attribution (`G 4`) | Overview, NAV vs Nifty 50, metrics, sector attribution, drawdown                                    |
| Research & Alerts (`G 5`)         | Sample research feed, alerts, trade blotter                                                         |
| Widget Marketplace (`G 6`)        | Browse all 13 widgets by category and add them to any page                                          |

**13 widgets**, each lazy-loaded as its own chunk:

| Widget                  | Category | Rendering                    | Data source               | Refresh |
| ----------------------- | -------- | ---------------------------- | ------------------------- | ------- |
| Portfolio Overview      | ANALYSIS | HTML tiles                   | `portfolio/summary`       | 5 s     |
| NAV vs Nifty 50         | CHART    | Recharts line                | `portfolio/nav-history`   | 30 s¹   |
| Asset Allocation        | CHART    | Recharts donut               | `portfolio/allocation`    | 15 s    |
| Drawdown                | CHART    | Recharts area                | `portfolio/nav-history`   | 30 s¹   |
| Sector Attribution      | CHART    | Recharts bars                | `performance/attribution` | 30 s¹   |
| Holdings                | TABLE    | react-virtuoso table         | `portfolio/holdings`      | 5 s     |
| Trade Blotter           | TABLE    | react-virtuoso table         | `trades/blotter`          | 5 s     |
| Research Feed           | FEED     | react-virtuoso list          | `research/feed`           | 30 s¹   |
| Alerts                  | FEED     | HTML list                    | `alerts/active`           | 15 s    |
| Value at Risk           | GAUGE    | D3 arc gauge + SVG histogram | `risk/var`                | 30 s¹   |
| Risk-Adjusted Metrics   | ANALYSIS | HTML tiles                   | `risk/metrics`            | 30 s¹   |
| Sector Returns Heat Map | ANALYSIS | D3 scales + SVG              | `market/sector-returns`   | 15 s    |
| Holdings Treemap        | ANALYSIS | D3 squarified treemap        | `portfolio/holdings`      | 5 s     |

¹ `VITE_DATA_REFRESH_INTERVAL` (default 30 s): widgets backed by end-of-day data. Widgets driven
by the intraday tape keep their own 5–15 s intervals.

**Every widget has**: a header with title, info tooltip, last-updated time (IST) and actions
(refresh, configure, duplicate, remove with undo); a shimmer skeleton shaped like the widget; an
error state with message and Retry; a "No data available" empty state; an amber border plus
`Stale · HH:MM:SS IST` when data is older than 2× its refresh interval; a disconnected state
(and a banner that keeps the last data visible); reflow on resize; `role="region"` with an
`aria-label` and a throttled `aria-live="polite"` text summary; its own data subscription;
two Storybook stories (Default and Configured) and unit tests.

**Workstation features**: drag and resize (react-grid-layout, responsive breakpoints), lock
layout (`L`), global search for pages, widgets, Nifty 50 symbols and commands (`Ctrl/⌘+K` or `/`),
symbol detail, saved layouts with version history and restore, JSON export/import, compressed
share links (lz-string, validated on open), three themes plus a theme builder with computed WCAG
contrast checks, NSE market status in IST, notifications from rule-based alerts, and a
**simulated feed outage** switch (command bar → feed) to demonstrate disconnected and stale states.
Each page holds up to `VITE_MAX_WIDGETS` widgets (default 20). Adding, duplicating or loading a
layout beyond that is refused with a message.

## Configuration

All configuration comes from `.env` (copy `.env.example`). Every variable is validated with zod
at startup, and an invalid value stops the app with a message naming the variable.

| Variable                     | Default in `.env.example` | Effect                                                                                                                                                                               |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL`          | `/api`                    | Base path for API requests, e.g. `GET /api/risk/var`. The mock API answers in the browser and makes no network request; the path appears in widget info, settings and error messages |
| `VITE_WS_URL`                | `ws://localhost:5173/ws`  | Reserved for a live market-data feed. Validated, but not opened while the simulated feed is in use                                                                                   |
| `VITE_DEFAULT_THEME`         | `light`                   | Theme for first-time visitors: `light` (Porcelain), `dark` (Midnight Graphite) or `high-contrast`. Applied before first paint; a theme the user picks is remembered                  |
| `VITE_DATA_REFRESH_INTERVAL` | `30000`                   | Refresh (ms) for end-of-day widgets (see the widget table)                                                                                                                           |
| `VITE_MAX_WIDGETS`           | `20`                      | Maximum widgets per page                                                                                                                                                             |
| `VITE_ENABLE_MOCK_AUTH`      | `true`                    | Sign in automatically as the demo portfolio manager; `false` shows a guest. There is no real authentication                                                                          |
| `VITE_DATA_SEED`             | `20240615`                | Seed for the shared simulated dataset                                                                                                                                                |
| `VITE_API_LATENCY_MS`        | `180`                     | Simulated request latency                                                                                                                                                            |
| `VITE_MOCK_ERROR_RATE`       | `0`                       | Probability (0–1) that a mock request fails, to exercise error states                                                                                                                |
| `VITE_USD_INR_RATE`          | `83.5`                    | Fixed FX rate for USD figures                                                                                                                                                        |
| `VITE_TICK_INTERVAL_MS`      | `5000`                    | Simulated intraday tick interval                                                                                                                                                     |
| `VITE_SIMULATE_MARKET_OPEN`  | `true`                    | Keep ticking outside NSE hours (labelled "simulated ticks")                                                                                                                          |
| `VITE_ENABLE_DEVTOOLS`       | `false`                   | Zustand Redux-DevTools bridge in dev builds                                                                                                                                          |
| `VITE_APP_NAME`              | `Meridian Capital`        | Name in the command bar                                                                                                                                                              |

**Content Security Policy.** `index.html` sets `script-src 'self'`: scripts load only from the
app's own origin, with no inline scripts and no `eval`. The theme pre-paint script is therefore a
file (`public/theme-init.js`). The Vite dev server alone adds `'unsafe-inline'` so React Fast
Refresh can inject its preamble; production builds and `vite preview` keep the strict policy.

## Stack

Vite 6 · React 18 · TypeScript 5 (`strict`) · react-grid-layout · Recharts · D3 · TanStack
Query 5 · Zustand 4 (persist, devtools, immer) · Tailwind CSS 3 with CSS custom-property tokens ·
Framer Motion 11 (lazy features) · Storybook 8 · Vitest + RTL · zod · react-virtuoso ·
react-colorful · lz-string · DOMPurify. No Redux, no CSS-in-JS, no Next.js.

## Project structure

```
src/
  components/   design-system primitives (buttons, overlays, form controls, state views, skeletons)
    charts/     chart helpers used only inside lazy widget chunks (not in the main barrel)
  widgets/      one folder per widget: index.tsx, config.ts, types.ts, model.ts, __tests__/
  grid/         DashboardGrid (react-grid-layout), WidgetFrame (states + header), ConfigPanel
  layout/       AppShell, NavRail, CommandBar, CommandPalette, LayoutManager, Marketplace, ...
  theme/        tokens, applyTheme, theme sync, ThemeMenu, lazy ThemeBuilder, global.css
  data/         seeded dataset, intraday simulation, derivations, zod schemas, mock API
  store/        DashboardStore, WidgetStore, ThemeStore, LayoutStore, cross-store actions, share
  registry/     WidgetRegistry + singleton, definition and config validators, defineWidget, pages
  hooks/        useEndpoint, useElementSize, useNow, useConnection, useHashRoute, ...
  utils/        env (zod), finance maths, IST/NSE calendar, formatting, colour, sanitise
  types/        WidgetDefinition contract, data, layout and theme types
  stories/      Storybook stories (41 files, 88 stories) and story helpers
  __tests__/    test setup, fixtures, integration tests
```

Every folder has an `index.ts` barrel (widget folders use `index.tsx`).

## Architecture in brief

- **Widget contract.** Each `config.ts` exports a `WidgetDefinition<TConfig, TData>` with the exact
  fields from the brief (`id`, `name`, `description`, `category`, `defaultSize`, `minSize`,
  `maxSize?`, `configSchema` (JSON Schema 7), `defaultConfig`, `component` (`React.lazy`), `icon`,
  `dataSource`). `defineWidget` wraps it into a registry entry, and the `WidgetRegistry`
  singleton validates every contract field at registration and rejects duplicate ids. Widgets
  of different types share one registry without `any` or casts: config is checked by the
  widget's zod schema (and its JSON Schema in the settings drawer), and data by a type guard
  that only accepts objects the API validated.
- **One dataset.** `src/data/dataset.ts` builds a single seeded dataset. Every endpoint derives
  from it plus a deterministic intraday tape, so totals and weights agree across widgets. Tests
  check this, e.g. day P&L in the overview equals the sum over holdings.
- **Mock API.** `fetchEndpoint` simulates latency, optional failures (`VITE_MOCK_ERROR_RATE`)
  and outages. It serialises each response to JSON and validates it with zod (no NaN, Infinity
  or non-positive prices; allocations must sum to 100%). TanStack Query handles caching,
  polling and de-duplication; queries pause while the feed is disconnected.
- **Four stores.** DashboardStore (grid settings, layouts per page and breakpoint, add, remove,
  move and resize, lock, preferences), WidgetStore (instances and settings), ThemeStore (active
  and custom themes, builder draft), LayoutStore (saved layouts, versions, share links). Every
  store action has a unit test. Components select small slices. Persisted state
  is validated with zod on load and holds only layouts, settings, theme and preferences, never
  datasets.
- **Themes without re-renders.** Tokens are CSS custom properties. Tailwind classes and SVG fills
  reference them directly, so a theme switch writes ~20 variables and re-renders no charts. A
  pre-paint script in `index.html` applies the cached theme before first paint.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Measured results

Measured on 21 Oct 2026 on the development machine (Windows 11, Chrome via Playwright, headless).
These are measurements on one machine, not guarantees. Method and raw output:
[docs/PERFORMANCE.md](docs/PERFORMANCE.md).

| Target (brief)                  | Result                                                                                                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main bundle < 150 KB gzip       | **124.6 KB** gzip (`npm run analyze`)                                                                                                                                                                      |
| Widget chunk < 50 KB gzip       | Widget chunks **0.7–2.1 KB**; largest lazy chunk 18.2 KB (animation features). Shared Recharts vendor chunk is **137.1 KB** gzip, loaded on first chart                                                    |
| Initial load, 10 widgets < 2 s  | **1.07–1.22 s** until all 10 widgets show data (median 1.12 s over 5 runs, local preview server)                                                                                                           |
| Drag > 55 FPS                   | **~60 FPS** during a widget drag (p95 frame 16.8 ms)                                                                                                                                                       |
| Theme change < 100 ms, no flash | **37–96 ms** click to next paint (first switch on 5 fresh loads); transitions are suspended for the switch                                                                                                 |
| Re-render < 100 ms on new data  | **≤ 12.5 ms** per widget render (React Profiler, development build)                                                                                                                                        |
| Lighthouse > 85                 | Desktop preset: **Performance 98–99, Accessibility 100, Best Practices 100, SEO 100** (3 runs). Mobile preset (4× CPU throttling): Performance **60–62**: the chart-heavy workstation is built for desktop |
| Layout JSON < 50 KB             | Default pages **< 5 KB** each; enforced at share time                                                                                                                                                      |
| Coverage > 70%                  | **94.4% lines, 80.6% branches, 80.1% functions** (v8, 247 tests)                                                                                                                                           |
| Storybook ≥ 90% of components   | **54 / 54** production components referenced by a story (`npm run story-coverage`)                                                                                                                         |

A WCAG contrast check runs for every built-in theme in the test suite. No formal WCAG
conformance audit has been done, and the app does not claim conformance.

## Data and calculations

All assumptions (GBM parameters, calendar, VaR methods, Sharpe, attribution simplifications,
AUM and FX) are in [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md). In short:

- Prices follow geometric Brownian motion (a market factor plus idiosyncratic noise per stock).
  Fund NAV daily moves are kept within 0.1–2%, and the history contains one calibrated ~35% drawdown.
- Full-period Sharpe is calibrated into the 0.3–2.5 band; risk-free rate is 6.75%.
- VaR: historical simulation (252-day lookback) and parametric (normal), 1-day, with expected shortfall.
- Attribution is a **simplified** single-period Brinson-Fachler model and is labelled as such.

## Known limitations

- Widgets are moved by pointer only; react-grid-layout has no keyboard move/resize. Every widget
  action (configure, duplicate, remove, refresh) is keyboard accessible.
- The NSE holiday list is approximate (good enough for the simulation calendar, not for production).
- Intraday ticks run outside NSE hours by default (`VITE_SIMULATE_MARKET_OPEN=true`) so the demo
  is never frozen; the command bar still shows the real NSE session status and says "simulated
  ticks". Set it to `false` to freeze prices at the last close outside hours.
- Mobile Lighthouse performance is below 85 under 4× CPU throttling (see above).
