# Performance: method and measurements

All numbers below were **measured** on 21 Oct 2026 on the development machine: Windows 11,
Google Chrome launched headless through Playwright (Python), production build served by
`vite preview` on localhost. They are one machine's measurements, not guarantees. Network
latency is the mock API's simulated latency (`VITE_API_LATENCY_MS=180` ± jitter).

## How to reproduce

```bash
npm run build
npx vite preview --port 4173          # terminal 1 (production build)
npx vite --port 5173                  # terminal 2 (dev server, for React Profiler timings)
python scripts/measure-perf.py        # needs: pip install playwright
npm run analyze                       # bundle sizes and budgets
npx lighthouse http://localhost:4173/#/workstation --preset=desktop
```

## Bundle sizes (`npm run analyze`, gzip level 9)

| Chunk                         | gzip                            | Notes                                                                                    |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| Main entry                    | **124.6 KB**                    | React, react-grid-layout, TanStack Query, Zustand, zod, data layer, shell. Budget 150 KB |
| Each widget chunk             | **0.7–2.1 KB**                  | One `React.lazy` chunk per widget. Budget 50 KB                                          |
| Animation features            | 18.2 KB                         | Framer Motion `domAnimation`, loaded via `LazyMotion` after first paint                  |
| Theme builder                 | 1.6 KB (+3.8 KB react-colorful) | Loaded only when opened                                                                  |
| Shared vendor: Recharts       | 137.1 KB                        | Loaded on the first chart widget; shared by all Recharts widgets                         |
| Shared vendor: D3             | 31.5 KB                         | Scales, arcs, hierarchy (also used by Recharts)                                          |
| Shared vendor: react-virtuoso | 20.7 KB                         | Tables and feeds                                                                         |
| CSS                           | 6.9 KB                          | Tailwind, purged                                                                         |

The per-widget budget is met by the widget code itself. Recharts cannot be split per widget,
so it is a shared lazy vendor chunk that is cached after the first chart loads.

## Runtime (`scripts/measure-perf.py`)

| Measurement                        | Result                                                                                   | Method                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Initial load, 10 widgets with data | runs: 1220, 1072, 1124, 1143, 1080 ms (median 1.12 s)                                    | Fresh browser context. Time from navigation start until all 10 widget bodies have rendered content and no skeleton remains |
| Theme switch, click to next paint  | first switch on 5 fresh loads: 96.1, 37.1, 37.0, 64.9, 38.1 ms; later switches ≤ 57.9 ms | Click a theme option, then wait two `requestAnimationFrame`s                                                               |
| Drag                               | 59.8 FPS average, p95 frame 16.8 ms, worst frame 33.2 ms                                 | `requestAnimationFrame` timestamps while dragging the NAV widget across 120 pointer moves                                  |
| Widget re-render on new data       | max 12.5 ms, p95 4.5 ms over 110 updates in 25 s                                         | `React.Profiler` `actualDuration` in the **development** build (slower than production)                                    |

## Lighthouse 12.6

| Preset                             | Performance | Accessibility                                  | Best practices | SEO |
| ---------------------------------- | ----------- | ---------------------------------------------- | -------------- | --- |
| Desktop (3 runs)                   | 98, 99, 99  | 100                                            | 100            | 100 |
| Mobile, 4× CPU throttling (2 runs) | 60, 62      | 95 at the time (button-name issue since fixed) | 100            | 100 |

Desktop Total Blocking Time was 0–10 ms in those runs. The first Lighthouse run right after a
fresh build sometimes scored 64–67 (TBT ~600–1,100 ms). Waiting ~45 s after the build removed
the effect. The project sits in a OneDrive-synced folder, and syncing the new build output is
the likely cause, but this was not proven.

The mobile score reflects a desktop-oriented, chart-heavy workstation rendered under simulated
4× CPU slowdown. Most blocking time there is Recharts layout work for the first charts.

## What was done to get here

- **Code splitting**: every widget is `React.lazy`; Recharts, D3, react-virtuoso and
  react-colorful are separate vendor chunks; Framer Motion features load lazily (`LazyMotion`).
- **Theme switching without React**: tokens are CSS variables written by `applyTheme`. Charts
  use `rgb(var(--token))` in SVG attributes, so no chart re-renders on a theme change. CSS
  transitions are suspended for the frame of the switch (no fade, no flash). A pre-paint script
  applies the cached theme before first paint.
- **Grid**: the grid measures its own width and renders once at the real size (no layout at a
  default width first). Widget bodies are `memo`ised and children are memoised on the id list,
  so dragging re-renders frames, not chart bodies. `useCSSTransforms` is on.
- **Data**: widget bodies take new data via `useDeferredValue` (transition priority), so React
  can spread renders across frames. Responses keep object identity (no structural sharing),
  and derived series are `useMemo`ised.
- **Charts**: line and area charts keep about one point per 3 px (max 300). Date axes use a fixed
  tick interval so Recharts does not measure every label in the DOM. Animations are off for
  data-driven charts.
- **Simulation**: the first request catches the intraday tape up in yielding slices of 1,200 ticks.
- **Accessibility live regions** are throttled to one announcement per 15 s per widget, so
  ticking prices don't flood screen readers (the first summary is immediate).
