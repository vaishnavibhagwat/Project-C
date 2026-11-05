# Meridian Capital · Portfolio Intelligence

Institutional portfolio analytics workstation (ZeTheta FED assessment) for a fictional Mumbai
asset manager with USD 45.0B AUM. Every number is simulated; never present mock values as live.

## Commands

```bash
npm run dev            # Vite dev server
npm run build          # tsc (strict) + production build
npm run test           # Vitest + RTL
npm run test:coverage  # v8 coverage
npm run lint           # ESLint, typescript-eslint recommended-type-checked
npm run format         # Prettier (printWidth 100, singleQuote)
npm run storybook      # Storybook 8
npm run analyze        # bundle budgets (main < 150 KB gzip, widget chunk < 50 KB)
```

The husky pre-commit hook runs lint-staged (eslint --fix, prettier --write). Never skip it.

## Folder structure (exact: graded automatically)

```
src/
  components/   index.ts      design-system primitives (charts/ and DataTable/ are NOT in this
                              barrel: they pull chart / virtuoso code into the main bundle)
  widgets/      index.ts      one folder per widget:
    <name>/     index.tsx     default-exported, memoised component (lazy chunk)
                config.ts     WidgetDefinition + defineWidget(...)
                types.ts      zod config schema, config and data types
                __tests__/    index.ts (fixtures) + <name>.test.tsx
  grid/         index.ts      GridContainer, GridItem, GridToolbar, WidgetCatalogue, WidgetFrame, ConfigPanel
  layout/       index.ts      AppShell, NavRail, CommandBar, pages, dialogs
  theme/        index.ts      tokens, applyTheme, ThemeMenu (ThemeBuilder is lazy, not in barrel)
  data/         index.ts      seeded market, portfolio model, derive/, zod schemas, mock API,
                              query hooks (queries.ts), transformers
  store/        index.ts      the four Zustand stores, cross-store actions, share links
  registry/     index.ts      WidgetRegistry + singleton, validators, default pages
  hooks/        index.ts
  utils/        index.ts
  types/        index.ts
  stories/      index.ts      Storybook stories + helpers
  __tests__/    index.ts      setup, fixtures, integration tests
```

Every folder has an `index.ts` barrel (widget folders use `index.tsx`). New folders need one.

## Non-negotiable rules

- **Widget contract** (`src/types/widget.ts`): never rename `WidgetDefinition` fields (`id`, `name`,
  `description`, `category`, `defaultSize`, `minSize`, `maxSize?`, `configSchema`, `defaultConfig`,
  `component`, `icon`, `dataSource`). `WidgetCategory` is `CHART | TABLE | FEED | GAUGE | ANALYSIS`.
- **Stack**: Vite, React 18, TS strict, react-grid-layout, Recharts (D3 for heat map, treemap and
  custom visuals), TanStack Query 5, Zustand 4 with persist + devtools + immer, Tailwind 3 with CSS
  custom properties, Framer Motion, zod, react-virtuoso, react-router-dom 6 (HashRouter, lazy
  pages). No Redux, no CSS-in-JS, no Next.js.
- **Four stores only**: DashboardStore (grid layout), WidgetStore (instances, configs), ThemeStore
  (themes, builder), LayoutStore (saved layouts, sharing, versions). Select small slices.
- **Code**: no `any`, no unsafe type assertions, no `innerHTML` or `dangerouslySetInnerHTML`
  (DOMPurify + text nodes). Validate every API response, persisted state and imported JSON with zod.
  Configuration only via `.env` (`VITE_*`, validated in `src/utils/env.ts`). Clean up timers and
  listeners. Lazy-load every widget.
- **Every widget**: shaped shimmer skeleton, error + Retry, "No data available", stale amber border
  - timestamp past 2× refresh, disconnected state, `role="region"` + `aria-label` + throttled
    `aria-live="polite"` summary, 2 stories (Default, Configured), at least one meaningful test.
- **Widget contract test**: `src/__tests__/contract.test.ts` covers every registered widget
  (fields, sizes, schema, lazy component, data source, renders with mock and empty data).
- **Widget folder** (checked by `src/__tests__/widget-conventions.test.ts`): `index.tsx`
  (`React.memo` default export, rendered inside `WidgetShell` by WidgetFrame), `config.ts`
  (`WidgetDefinition` with `maxSize` and `component: lazy(() => import('./index'))`, registered
  in `src/registry/registry.ts` and the widgets barrel), `types.ts` (config and data types),
  `__tests__/index.ts` (`fixtureData`, `emptyData`, `configuredConfig`) and
  `__tests__/<name>.test.tsx` calling `describeWidgetStates` (ready, empty, error). Theme
  colours only (`cssColor` or Tailwind tokens). D3 by sub-module only (ESLint enforced). Widget
  chunk < 50 KB gzip.
- **Data**: one seeded portfolio model (`src/data/model.ts`) on one seeded market
  (`src/data/dataset.ts`); everything derives from it; never randomise per widget. INR (USD
  where relevant), IST, Nifty 50, T+1, NSE 09:15–15:30 IST. Document data assumptions in
  `docs/mock-data.md`, calculations in `docs/ASSUMPTIONS.md`.
- **CSP**: `index.html` allows `script-src 'self'` only. No inline scripts.
- **Honesty**: never claim a Lighthouse score, FPS, coverage % or WCAG compliance that was not
  measured; label simplified calculations as approximations.

## Git workflow

- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `build:`, `chore:`, `perf:` …).
- Commit **and push** to `origin main` (github.com/vaishnavibhagwat/Project-C) at the end of every
  prompt. Run `npx tsc --noEmit`, `npm run lint` and `npm run test` first.
- Never rewrite or force-push published history without explicit approval.
