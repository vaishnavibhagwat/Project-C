# Adding a widget

There are two ways to add a widget to the workstation:

1. **Built-in widget**: a folder in `src/widgets/`, registered at start-up in `src/registry/registry.ts`.
2. **Plugin**: a separate package that registers its widgets at runtime through the registry
   API. The Widget Marketplace installs it without a reload. `src/registry/plugins/demo-top-movers/`
   is a working example.

Both kinds use the same contract and pass the same contract test (`src/__tests__/contract.test.ts`).

## The contract: `WidgetDefinition`

Defined in `src/types/widget.ts`. Do not rename these fields.

| Field           | Type                                    | Notes                                                                              |
| --------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| `id`            | `string`                                | Kebab case, unique in the registry. Persisted in layouts, so never change it.      |
| `name`          | `string`                                | Header title and `aria-label` of the widget region.                                |
| `description`   | `string`                                | Shown on the marketplace card. More than 10 characters.                            |
| `category`      | `WidgetCategory`                        | `CHART`, `TABLE`, `FEED`, `GAUGE` or `ANALYSIS`.                                   |
| `defaultSize`   | `{ w, h }`                              | Grid units (12 columns). `minSize ≤ defaultSize ≤ maxSize`.                        |
| `minSize`       | `{ w, h }`                              | At least 1 × 1.                                                                    |
| `maxSize?`      | `{ w, h }`                              | Required by the folder conventions. Width at most 12.                              |
| `configSchema`  | JSON Schema 7 (`type: 'object'`)        | Drives the settings form. Mark keys the widget sets itself with `readOnly`.        |
| `defaultConfig` | object of strings, numbers and booleans | Must pass `configSchema` and the zod parser. Lists are stored as CSV or JSON.      |
| `component`     | `lazy(() => import(...))`               | Always lazy, so each widget is its own chunk (< 50 KB gzip).                       |
| `icon`          | React component                         | From `src/components/Icons.tsx`.                                                   |
| `dataSource`    | `DataSourceConfig`                      | `endpoint`, optional `wsChannel`, `refreshInterval` (≥ 1000 ms), `latencyProfile`. |

`dataSource.endpoint` must be one of the simulated endpoints in `src/data/endpointSchemas.ts`. Each
response is checked with zod before your component sees it. If you set a `wsChannel`, it must be a
channel in `src/data/realtime.ts` that refreshes the same endpoint.

### Component props

Your component receives `WidgetComponentProps<TConfig, TData>`:

```ts
{
  instanceId, config, data,       // config is parsed, data is validated
  isLoading, error, isStale, lastUpdated,
  onConfigChange(patch),          // persist a setting (sort, filters, …)
  width, height,                  // pixel size of the body
}
```

You only render the ready state. `WidgetFrame` wraps every widget in a `WidgetShell` that already
handles the shaped skeleton, errors with Retry, "No data available", the stale amber border and
timestamp, the disconnected state, `role="region"` with `aria-label`, and a throttled
`aria-live="polite"` summary.

## `defineWidget`

`defineWidget(definition, options)` (`src/registry/defineWidget.tsx`) turns a typed definition into
the `RegisteredWidget` the registry stores. It checks the config (zod) and the data (type guard)
at runtime, so no unsafe casts are needed.

```ts
export const myWidget = defineWidget(myDefinition, {
  configParser: MyConfigSchema, // zod schema for the config
  isData: isEndpointData('portfolio/holdings'),
  isEmpty: (d) => d.holdings.length === 0, // shows "No data available"
  summarize: (d, c) => '…', // text for the live region and screen readers
  skeleton: 'table', // shimmer shape while loading
  preload: () => import('./index'), // marketplace hover preloads the chunk
});
```

Optional: `emptyMessage` (text under "No data available") and `badge` (a count in the header).

## A built-in widget, step by step

1. Create `src/widgets/<id>/` with:
   - `types.ts`: the zod config schema, the config type and the data type.
   - `config.ts`: the `WidgetDefinition` (with `maxSize` and `component: lazy(() => import('./index'))`)
     and the `defineWidget(...)` call.
   - `index.tsx`: the component, default-exported and wrapped in `React.memo`.
   - `__tests__/index.ts`: exports `fixtureData`, `emptyData` and `configuredConfig`.
   - `__tests__/<id>.test.tsx`: at least one meaningful test, plus
     `describeWidgetStates('<id>', { data: fixtureData, emptyData })`.
2. Register it in `BUILT_IN_WIDGETS` in `src/registry/registry.ts` and export it from
   `src/widgets/index.ts`.
3. Add two stories in `src/stories/<Name>Widget.stories.tsx`: `Default` and `Configured`.
4. Use theme colours only (`cssColor(...)` or Tailwind tokens such as `text-pos`). Import D3 by
   sub-module (`d3-scale`, not `d3`); ESLint enforces this.
5. Run `npm run test`. `widget-conventions.test.ts` checks the folder and `contract.test.ts` checks
   the definition, and both pick up the new widget on their own. Then run `npm run analyze` to check
   the chunk budget.

## A plugin (runtime registration)

A plugin is a package that exports a `WidgetPlugin` (`src/registry/plugins/types.ts`):

```ts
export const plugin: WidgetPlugin = {
  id: 'demo-top-movers',
  install(registry) {
    registry.registerWidget(topMoversWidget);
  },
  uninstall(registry) {
    registry.unregisterWidget(topMoversWidget.id);
  },
};
```

`registry` is the public registry API: `registerWidget`, `unregisterWidget`, `hasWidget` and
`getWidget`. `registerWidget` validates the whole definition. It throws
`InvalidWidgetDefinitionError` for a broken contract and `DuplicateWidgetError` for an id that
is already taken.

To offer the plugin in the marketplace, add a manifest to `AVAILABLE_PLUGINS` in
`src/registry/plugins/index.ts`:

```ts
{
  id: 'demo-top-movers',
  name: 'Top Movers',
  publisher: 'Demo Labs (fictional third party)',
  version: '1.0.0',
  description: '…',
  widgetIds: ['demo-top-movers'],
  load: () => import('./demo-top-movers').then((m) => m.plugin),
}
```

Only the manifest is in the main bundle. The plugin's code is a separate chunk, fetched when the
user clicks **Install plugin**. The plugin host (`src/registry/pluginHost.ts`) then works like this:

- `installPlugin(id)` loads the chunk, calls `plugin.install(widgetRegistry)`, and saves the id in
  DashboardStore (`installedPlugins`).
- Installed plugins are installed again on the next start-up (`restoreInstalledPlugins`, called by
  the app shell). Until then, their widgets show "Loading plugin". A plugin that no longer loads
  is forgotten, and its widgets show "Widget unavailable" with a Remove button.
- `uninstallPlugin(id)` removes the plugin's widgets from every page, then from the registry.
- The registry notifies subscribers on every change (`widgetRegistry.subscribe`,
  `useRegistryVersion`). The marketplace, the catalogue side panel, the placeholder menu, the
  command palette and every widget frame re-render, so a new widget appears without a reload.

Plugin widgets follow the same folder layout. The package entry is `index.ts` and the component
is a separate lazy file. Fixtures go in `<plugin>/__tests__/index.ts`. `contract.test.ts` installs
every manifest in `AVAILABLE_PLUGINS` before it runs, so plugin widgets meet the same contract as
built-in ones.

### Limits of the demo

The demo plugin ships inside this repository and is bundled by Vite as its own chunk. A real
marketplace would load packages from a separate origin, which would need its own sandboxing,
signing and a CSP change (`script-src 'self'` allows only same-origin code today). None of that is
implemented here.
