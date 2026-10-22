# Architecture

## Data flow

```
 .env (VITE_*) ──► utils/env.ts (zod-validated config)
                        │
 data/dataset.ts ◄──────┘   one seeded dataset per (seed, as-of day, FX)
        │
 data/market.ts             deterministic intraday GBM tape (per tick, seeded)
        │
 data/derive/*.ts           summary, holdings, allocation, NAV, sector returns,
        │                   VaR, metrics, attribution, trades, research, alerts
 data/api.ts  fetchEndpoint(endpoint)
        │   latency → outage check → error injection → derive → JSON round trip
        │   → zod parse (schemas.ts) → object tagged as validated
        ▼
 hooks/useEndpoint.ts       TanStack Query: key per endpoint, refetchInterval per widget,
        │                   paused while the feed is disconnected (onlineManager)
        ▼
 grid/WidgetFrame.tsx       states (skeleton, error, empty, stale, disconnected), header
        │                   actions, aria-live summary, measured size, useDeferredValue
        ▼
 registered component       validates config (zod) and data (type guard), then renders the
        │                   widget's own lazy component
        ▼
 widgets/<name>/index.tsx   pure presentation of (config, data, width, height)
```

## The widget contract

`src/types/widget.ts` defines `WidgetDefinition<TConfig, TData>` with exactly the fields in the
brief. Each widget's `config.ts` exports one, typed with the widget's own config and data
types:

```ts
export const varGaugeDefinition: WidgetDefinition<VarGaugeConfig, VarGaugeData> = {
  id: 'var-gauge',
  name: 'Value at Risk',
  description: '…',
  category: WidgetCategory.GAUGE,
  defaultSize: { w: 3, h: 10 },
  minSize: { w: 3, h: 7 },
  configSchema: { type: 'object', properties: { … } },   // JSON Schema 7, drives the form
  defaultConfig: { confidence: '99', method: 'historical', … },
  component: lazy(() => import('./index')),               // own chunk
  icon: IconShield,
  dataSource: {
    endpoint: 'risk/var',
    refreshInterval: env.VITE_DATA_REFRESH_INTERVAL,   // ms
    latencyProfile: 'high',                             // low | normal | high
  },
};
```

`defineWidget(definition, { configParser, isData, summarize, skeleton, preload })` turns it
into a `RegisteredWidget`: a type-erased `WidgetDefinition` (its `component` is still a
`React.lazy` component) plus the helpers the grid needs. The widget's types are checked at
runtime rather than erased with casts:

- **Config**: stored settings are merged over defaults and parsed with the widget's zod schema.
  A value that fails validation falls back to its default, and valid values are kept.
- **Data**: `isEndpointData(endpoint)` is a type guard that accepts only objects returned by
  `parseEndpoint` for that endpoint (a `WeakMap` records validated objects).

Widgets receive `WidgetComponentProps`: `instanceId`, `config`, `data`, `isLoading`, `error`,
`isStale`, `lastUpdated` (IST ISO), `onConfigChange(patch)`, `width` and `height`. A widget
instance is `{ instanceId, widgetId, config, position: { x, y, w, h } }`; `position` mirrors the
large-breakpoint grid layout in DashboardStore.

`DataSourceConfig.latencyProfile` scales the mock API's simulated latency (low ×0.4, normal ×1,
high ×2.5) so heavy analytics endpoints feel slower than quotes. `wsChannel` is optional and
reserved: mock mode polls and nothing opens a WebSocket.

### The registry

`WidgetRegistry<T extends WidgetDefinition = WidgetDefinition>` (`src/registry/WidgetRegistry.ts`)
is a class backed by a `Map<string, T>` with `registerWidget`, `getWidget`, `hasWidget`,
`getAllWidgets` (registration order), `getWidgetsByCategory`, `unregisterWidget` and
`validateConfig(id, config)`. The app uses one singleton, `widgetRegistry`, typed with
`RegisteredWidget` (a `WidgetDefinition` plus grid helpers) and filled in
`src/registry/registry.ts`. Registration throws:

- `DuplicateWidgetError` when the id is already registered;
- `InvalidWidgetDefinitionError` (with one line per problem) when `validateWidgetDefinition`
  rejects the definition. It checks every contract field at runtime: kebab-case id, non-empty
  name and description, a known category, positive integer sizes with
  `minSize ≤ defaultSize ≤ maxSize`, a `configSchema` that uses only supported keywords, a
  `defaultConfig` with exactly one valid default per schema property, a `React.lazy`
  component, an icon component, and a data source with a known endpoint, a refresh interval of
  at least 1 s and a latency profile.

In development and tests a bad built-in widget fails start-up loudly; in production it is
logged and skipped so the rest of the workstation still loads.

`validateWidgetConfig(config, configSchema)` checks settings against a widget's JSON Schema. It
implements the draft-7 subset widget settings need (`type`, `properties`, `required`,
`additionalProperties`, `enum`, `const`, `oneOf`, `anyOf`, `allOf`, numeric bounds,
`multipleOf`, string lengths and `pattern`) and fails closed on any other keyword. Ajv is not
used because it compiles validators with `new Function`, which the CSP blocks. The settings
drawer shows these errors next to each field and disables Save while any remain.

### Adding a widget

1. Create `src/widgets/my-widget/` with `types.ts` (zod config schema + types), `index.tsx`
   (default-exported, `memo`ised component), `config.ts` (definition + `defineWidget`), an
   optional pure `model.ts`, and `__tests__/` (an `index.ts` with fixtures and a test).
2. Add the result to `BUILT_IN_WIDGETS` in `src/registry/registry.ts` (it is validated and
   registered there) and re-export it from `src/widgets/index.ts`.
3. Add `src/stories/MyWidget.stories.tsx` with `Default` and `Configured` stories.

The frame supplies everything else: states, header, settings panel, stale detection,
accessibility summary, resize and drag.

## Domain types

`src/types/domain.ts` holds the spec's entities, each mirrored by a zod schema in
`src/data/schemas.ts` (`satisfies z.ZodType<T>`, so the two cannot drift):

| Type          | Fields                                                                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Portfolio`   | portfolioId, name, aum, dailyPnL, dailyPnLPercent, mtdReturn, ytdReturn, sharpeRatio, benchmark, lastUpdated                                                                 |
| `Holding`     | holdingId, ticker, name, sector, assetClass, quantity, averageCost, currentPrice, marketValue, dailyPnL, dailyPnLPercent, weight, currency                                   |
| `NewsArticle` | articleId, headline, summary, source, publishedAt, sentiment, sentimentScore (−1..1), relevantTickers[], category                                                            |
| `Alert`       | alertId, type (price_breach, risk_limit, news_event, rebalance_signal), severity (info, warning, critical), message, triggeredAt, relatedWidget, relatedEntity, acknowledged |

Money is INR, percentages are in percent units (1.25 means 1.25%) and timestamps are IST ISO
strings. Unrealised P&L and previous close are derived from a `Holding` in
`src/utils/holdings.ts` rather than stored. `Layout` (a saved layout with versions), `Theme` and
`GridConfig` live in `src/types/layout.ts` and `src/types/theme.ts`.

## State: four stores

| Store            | Owns                                                                                                                  | Persisted (localStorage, zod-validated on load) |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `DashboardStore` | `gridConfig`, grid layouts per page and breakpoint, item order, lock, AUM currency preference, acknowledged alert ids | yes                                             |
| `WidgetStore`    | widget instances keyed by instanceId (type, title, settings, position); which settings panel is open                  | instances only                                  |
| `ThemeStore`     | active theme id, custom themes, builder draft (live preview)                                                          | active id + custom themes                       |
| `LayoutStore`    | `savedLayouts` with up to 20 versions each, active layout per page, the last 10 `shares`                              | everything                                      |

Actions per store:

- **DashboardStore**: `setGridConfig`, `resetGridConfig`, `addWidget`, `removeWidget`,
  `restoreWidget` (undo), `moveWidget`, `resizeWidget`, `setLayouts`, `replacePage`,
  `setLocked`, `setDisplayCurrency`, `acknowledgeAlerts`.
- **WidgetStore**: `createInstance`, `upsertInstances`, `updateConfig`, `replaceConfig`,
  `renameInstance`, `setPositions`, `removeInstances`, `duplicateInstance`, `openSettings`,
  `closeSettings`.
- **ThemeStore**: `setActiveTheme`, `openBuilder`, `closeBuilder`, `setDraftToken`,
  `setDraftName`, `setDraftMode`, `saveDraft`, `deleteCustomTheme`, `importTheme`.
- **LayoutStore**: `saveLayout`, `saveVersion`, `renameLayout`, `deleteLayout`, `setActive`,
  `recordShare`, `removeShare`, `clearShares`.

All four use `devtools(persist(immer(…)))`. The devtools bridge is enabled only in development
when `VITE_ENABLE_DEVTOOLS=true`. Components subscribe with narrow selectors
(`useShallow` where several fields are needed). Operations that touch two stores
(`addWidgetToPage`, `removeWidgetFromPage` with `restoreRemovedWidget`, `duplicateWidget`,
`applyGridConfig`, `captureSnapshot`, `applySnapshot`, `resetPage`) live in
`src/store/actions.ts`.

### Grid settings

`gridConfig` holds `cols` (6 to 24, default 12), `rowHeight` (30 to 100 px, default 60), `gap`
(4 to 20 px, default 8) and `compaction` (`vertical` or `none`). Narrower breakpoints derive
their columns from `cols` (12 gives 12/10/6/2). `setGridConfig` validates the merged settings
with zod and converts every page's layouts so widgets keep their width share and roughly their
pixel height. Widget `defaultSize`/`minSize`/`maxSize` and the default pages are written for
the default grid and converted on use. `moveWidget`, `resizeWidget` and `addWidget` keep
layouts valid on their own (inside the columns, no overlaps, compacted when `vertical`), using
the pure helpers in `src/utils/gridLayout.ts`; per-widget minimum and maximum sizes are
enforced by react-grid-layout in the UI.

Snapshots (saved versions and share links) record the grid they were captured on and are
converted when applied. Data saved before grid settings existed used 12 columns and 28 px rows;
the version 2 persist migrations convert it, and snapshots without a grid are treated as that
old grid.

Layout JSON contains grid positions, widget settings, theme and preferences, never datasets.
The default workstation snapshot is under 5 KB. Share links are capped at 50 KB before
compression.

## Sharing and import

`encodeShare` → `JSON.stringify` → size check (≤ 50 KB) → `lz-string`
`compressToEncodedURIComponent` → `#/<page>?share=…`. Opening a link decompresses, parses,
validates with zod (`SharePayloadSchema`) and sanitises titles with DOMPurify. It then shows a
banner, and nothing changes until the user clicks **Apply layout**. Imported layout and theme
JSON files go through the same zod schemas.

## Theming

- `src/theme/themes.ts`: three built-in themes (Midnight Graphite, Porcelain, High Contrast) as
  hex tokens.
- `applyTheme` writes `--color-*` custom properties as `r g b` channels, used by Tailwind
  (`rgb(var(--color-x) / <alpha>)`) and by SVG attributes (`cssColor('accent')`).
- `startThemeSync` subscribes to ThemeStore outside React. The theme builder's draft is
  previewed live and discarded on Cancel.
- `index.html` applies the last theme from a localStorage cache before the CSS paints (no flash).

## Security notes

- A Content Security Policy in `index.html` allows scripts only from the app's own origin
  (`script-src 'self'`): no inline scripts, no `eval`. The pre-paint theme script lives in
  `public/theme-init.js` for that reason. Only the Vite dev server relaxes the policy (for the
  React Fast Refresh preamble); a test checks `index.html` has no inline scripts.
- No `innerHTML` or `dangerouslySetInnerHTML` anywhere (ESLint rules forbid both). Untrusted text
  (layout names, imported titles, research summaries) is stripped with DOMPurify and rendered
  as React text nodes.
- All external input (persisted state, share links, imported JSON files, mock API responses,
  environment variables) is validated with zod before use.

## Accessibility

- Every widget is a `role="region"` with an `aria-label`, a throttled `aria-live="polite"`
  text summary, and keyboard-reachable actions. Heat map and allocation have text table
  equivalents.
- Direction is never shown by colour alone: values carry +/− signs and ▲/▼ arrows, statuses
  carry text labels.
- Dialogs trap focus and close on Escape, and the theme builder reports computed contrast ratios.
- Known gap: grid items can't be moved or resized with the keyboard (react-grid-layout limitation).
