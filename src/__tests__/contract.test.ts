import { screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ENDPOINT_IDS, parseEndpoint } from '@/data';
import { REALTIME_ROUTES } from '@/data/realtime';
import { parseChannelUrl } from '@/data/wsSimulator';
import { WidgetFrame } from '@/grid/WidgetFrame';
import { EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import { isComponentType, isLazyComponent } from '@/registry/definitionValidator';
import { AVAILABLE_PLUGINS } from '@/registry/plugins';
import { widgetRegistry } from '@/registry/registry';
import { useWidgetStore } from '@/store/widgetStore';
import { WidgetCategory, type GridSize } from '@/types';
import { DEFAULT_GRID_CONFIG } from '@/utils/gridLayout';
import { renderWithProviders } from './render';

/**
 * The WidgetDefinition contract, checked for every registered widget: field types, unique ids,
 * categories, sizes, default settings against their own schema, a lazy component, a valid data
 * source, and that each widget renders mock data and shows "No data available" for an empty
 * response. New widgets are covered as soon as they are registered, and the marketplace
 * plugins are installed first so their runtime-registered widgets are held to the same contract.
 */

interface WidgetFixtures {
  fixtureData: () => unknown;
  emptyData: () => unknown;
}
const fixtureModules = import.meta.glob<WidgetFixtures>(
  ['/src/widgets/*/__tests__/index.ts', '/src/registry/plugins/*/__tests__/index.ts'],
  { eager: true },
);
/** Built-in widgets live in src/widgets/<id>; plugin widgets in their plugin's folder. */
const fixtureDir = (id: string) => {
  const plugin = AVAILABLE_PLUGINS.find((p) => p.widgetIds.includes(id));
  return plugin ? `/src/registry/plugins/${plugin.id}` : `/src/widgets/${id}`;
};
const fixturesFor = (id: string): WidgetFixtures | undefined =>
  fixtureModules[`${fixtureDir(id)}/__tests__/index.ts`];

for (const manifest of AVAILABLE_PLUGINS) (await manifest.load()).install(widgetRegistry);
const widgets = widgetRegistry.getAllWidgets();
const CATEGORIES = Object.values(WidgetCategory);
const COLS = DEFAULT_GRID_CONFIG.cols;
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const isSize = (s: unknown): s is GridSize =>
  typeof s === 'object' &&
  s !== null &&
  'w' in s &&
  'h' in s &&
  Number.isInteger(s.w) &&
  Number.isInteger(s.h);
/** What the frame shows when a widget crashes, fails to load or gets data it cannot read. */
const CRASH = /failed to render|Failed to load widget|Couldn’t load this widget|unexpected shape/i;
const fits = (a: GridSize, b: GridSize) => a.w <= b.w && a.h <= b.h;

// Load every widget chunk once, up front, so the render tests do not pay the first-transform
// cost inside their own timeouts.
const chunks = import.meta.glob(['/src/widgets/*/index.tsx', '/src/registry/plugins/*/*.tsx']);
beforeAll(async () => {
  await Promise.all(Object.values(chunks).map((load) => load()));
}, 120_000);

describe('widget contract', () => {
  it('registers widgets with unique ids', () => {
    expect(widgets.length).toBeGreaterThanOrEqual(20);
    const ids = widgets.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(widgets.map((w) => [w.id, w] as const))('%s', (id, w) => {
    it('has every field with the right type', () => {
      expect(id).toMatch(KEBAB);
      expect(typeof w.name).toBe('string');
      expect(w.name.trim().length).toBeGreaterThan(0);
      expect(typeof w.description).toBe('string');
      expect(w.description.trim().length).toBeGreaterThan(10);
      expect(CATEGORIES).toContain(w.category);
      expect(isSize(w.defaultSize)).toBe(true);
      expect(isSize(w.minSize)).toBe(true);
      if (w.maxSize !== undefined) expect(isSize(w.maxSize)).toBe(true);
      expect(w.configSchema.type).toBe('object');
      expect(typeof w.defaultConfig).toBe('object');
      for (const v of Object.values(w.defaultConfig)) {
        expect(['string', 'number', 'boolean']).toContain(typeof v);
      }
      expect(isComponentType(w.icon)).toBe(true);
    });

    it('keeps minSize <= defaultSize <= maxSize, inside the grid', () => {
      expect(w.minSize.w).toBeGreaterThanOrEqual(1);
      expect(w.minSize.h).toBeGreaterThanOrEqual(1);
      expect(fits(w.minSize, w.defaultSize)).toBe(true);
      if (w.maxSize) expect(fits(w.defaultSize, w.maxSize)).toBe(true);
      expect((w.maxSize ?? w.defaultSize).w).toBeLessThanOrEqual(COLS);
    });

    it('has default settings that pass its own configSchema and zod parser', () => {
      expect(widgetRegistry.validateConfig(id, w.defaultConfig).errors).toEqual([]);
      expect(w.resolveConfig({})).toEqual(w.defaultConfig);
      for (const key of Object.keys(w.defaultConfig)) {
        expect(w.configSchema.properties, `${key} in configSchema`).toHaveProperty([key]);
      }
    });

    it('has a lazy component', () => {
      expect(isLazyComponent(w.component)).toBe(true);
      expect(isLazyComponent(w.createComponent())).toBe(true);
    });

    it('has a valid data source', () => {
      const ds = w.dataSource;
      expect(ENDPOINT_IDS).toContain(ds.endpoint);
      expect(Number.isInteger(ds.refreshInterval)).toBe(true);
      expect(ds.refreshInterval).toBeGreaterThanOrEqual(1000);
      expect(['low', 'normal', 'high']).toContain(ds.latencyProfile);
      if (ds.wsChannel !== undefined) {
        // A real simulated channel, and the realtime bridge refreshes this endpoint from it.
        expect(parseChannelUrl(ds.wsChannel), ds.wsChannel).not.toBeNull();
        const route = REALTIME_ROUTES.find((r) => r.url === ds.wsChannel);
        expect(route?.endpoints, `route for ${ds.wsChannel}`).toContain(ds.endpoint);
      }
      if (ds.onDemand !== undefined) expect(typeof ds.onDemand).toBe('boolean');
    });

    it('has fixtures that are valid responses of its endpoint', () => {
      const f = fixturesFor(id);
      if (!f) throw new Error(`${fixtureDir(id)}/__tests__/index.ts is missing`);
      expect(() => parseEndpoint(w.dataSource.endpoint, f.fixtureData())).not.toThrow();
      expect(() => parseEndpoint(w.dataSource.endpoint, f.emptyData())).not.toThrow();
      expect(w.isEmpty(f.fixtureData())).toBe(false);
      expect(w.isEmpty(f.emptyData())).toBe(true);
    });
  });
});

describe('widget rendering', () => {
  const initial = useWidgetStore.getState();
  afterEach(() => useWidgetStore.setState(initial, true));

  function renderWidget(id: string, body: () => unknown) {
    const w = widgetRegistry.getWidget(id);
    if (!w) throw new Error(`${id} is not registered`);
    const instanceId = `contract-${id}`;
    useWidgetStore.getState().upsertInstances([
      {
        instanceId,
        widgetId: id,
        config: w.defaultConfig,
        position: { x: 0, y: 0, ...w.defaultSize },
      },
    ]);
    const fetcher: EndpointFetcher = (endpoint) =>
      Promise.resolve().then(() => parseEndpoint(endpoint, body()));
    renderWithProviders(
      createElement(
        EndpointFetcherContext.Provider,
        { value: fetcher },
        createElement(WidgetFrame, { page: 'workstation', instanceId }),
      ),
    );
    return screen.getByRole('region', { name: w.name });
  }

  it.each(widgets.map((w) => w.id))('%s renders mock data without crashing', async (id) => {
    const f = fixturesFor(id);
    if (!f) throw new Error('missing fixtures');
    const region = renderWidget(id, f.fixtureData);
    const live = region.querySelector('[aria-live="polite"]');
    await waitFor(() => expect(live?.textContent?.trim()).not.toBe(''));
    expect(region.querySelector('[data-testid^="skeleton-"]')).toBeNull();
    expect(region).not.toHaveTextContent(CRASH);
    expect(screen.queryByText('No data available')).not.toBeInTheDocument();
  });

  it.each(widgets.map((w) => w.id))(
    '%s shows "No data available" for an empty response',
    async (id) => {
      const f = fixturesFor(id);
      if (!f) throw new Error('missing fixtures');
      const region = renderWidget(id, f.emptyData);
      expect(await screen.findByText('No data available')).toBeInTheDocument();
      expect(region).not.toHaveTextContent(CRASH);
    },
  );
});
