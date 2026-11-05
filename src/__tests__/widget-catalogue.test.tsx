import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { draggedCatalogueWidget } from '@/grid/catalogueDrag';
import { GridContainer } from '@/grid/GridContainer';
import { groupCatalogue, WidgetCatalogue } from '@/grid/WidgetCatalogue';
import { EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import { CATEGORIES, CATEGORY_LABELS, widgetRegistry } from '@/registry/registry';
import {
  addPlaceholder,
  dropWidgetOnPage,
  MAX_WIDGETS_PER_PAGE,
  undoLayoutChange,
} from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import { WidgetCategory, type GridItemLayout } from '@/types';
import { fixture, gridItem as item, hasOverlap } from './fixtures';
import { renderWithProviders } from './render';

const fixtureFetcher: EndpointFetcher = (endpoint) => Promise.resolve(fixture(endpoint));
const initial = { dashboard: useDashboardStore.getState(), widgets: useWidgetStore.getState() };
const store = () => useDashboardStore.getState();
const desktop = (): GridItemLayout[] => store().pages.performance.layouts.desktop ?? [];
const typesOnPage = () =>
  store().pages.performance.itemIds.map((id) => useWidgetStore.getState().instances[id]?.widgetId);

const OVERVIEW = 'performance-portfolio-overview';
const NAV = 'performance-nav-performance';
// Geometry from the test ResizeObserver: an 800 px grid, 12 columns, 8 px gaps, 60 px rows.
const COL_STEP = (800 - 11 * 8) / 12 + 8;

// Pre-compile widget chunks so first renders do not wait on the transform.
// No offsetParent stub here: with one, react-grid-layout's drop preview never settles in jsdom.
const widgetChunks = import.meta.glob('/src/widgets/*/index.tsx');
beforeAll(async () => {
  await Promise.all(Object.values(widgetChunks).map((load) => load()));
}, 120_000);

beforeEach(() => {
  useDashboardStore.setState(initial.dashboard, true);
  useWidgetStore.setState(initial.widgets, true);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  store().replacePage('performance', {
    itemIds: [OVERVIEW, NAV],
    layouts: { desktop: [item(OVERVIEW, 0, 0, 4, 3), item(NAV, 0, 3, 8, 6)] },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

function renderCatalogue(withGrid = false) {
  return renderWithProviders(
    <EndpointFetcherContext.Provider value={fixtureFetcher}>
      <main id="main" tabIndex={-1}>
        {withGrid ? <GridContainer page="performance" /> : null}
        <WidgetCatalogue page="performance" />
      </main>
    </EndpointFetcherContext.Provider>,
  );
}

/** Fill the performance page up to VITE_MAX_WIDGETS with empty slots. */
function fillPage() {
  while (store().pages.performance.itemIds.length < MAX_WIDGETS_PER_PAGE) {
    if (!addPlaceholder('performance')) throw new Error('could not fill the page');
  }
}

type DragKind = 'dragEnter' | 'dragOver' | 'drop';

/** Fire a drag event at a point. jsdom has no DragEvent, so coordinates are set by hand. */
function dragAt(kind: DragKind, target: Element, point: { clientX: number; clientY: number }) {
  const event = createEvent[kind](target);
  Object.defineProperty(event, 'clientX', { value: point.clientX });
  Object.defineProperty(event, 'clientY', { value: point.clientY });
  fireEvent(target, event);
}

const catalogue = () => screen.getByRole('complementary', { name: 'Widget catalogue' });
const items = () => within(catalogue()).queryAllByRole('button', { name: /^Add / });

/** The VaR gauge's default size, as the grid places it on a 12-column desktop grid. */
const VAR_SIZE = widgetRegistry.getWidget('var-gauge')?.defaultSize ?? { w: 0, h: 0 };

describe('groupCatalogue', () => {
  it('groups every widget under its category, in category order', () => {
    const groups = groupCatalogue(widgetRegistry.getAllWidgets(), '');
    expect(groups.map((g) => g.category)).toEqual(
      CATEGORIES.filter((c) => widgetRegistry.getWidgetsByCategory(c).length > 0),
    );
    expect(groups.flatMap((g) => g.widgets)).toHaveLength(widgetRegistry.size);
    for (const g of groups) expect(g.widgets.every((w) => w.category === g.category)).toBe(true);
  });

  it('matches name, description and category label, ignoring case', () => {
    const names = (q: string) =>
      groupCatalogue(widgetRegistry.getAllWidgets(), q).flatMap((g) => g.widgets.map((w) => w.id));
    expect(names('  VAR ')).toContain('var-gauge');
    expect(names('gauges')).toEqual(
      widgetRegistry.getWidgetsByCategory(WidgetCategory.GAUGE).map((w) => w.id),
    );
    expect(names('zzz-no-such-widget')).toEqual([]);
  });
});

describe('WidgetCatalogue', () => {
  it('lists every registered widget by category with icon, name and description', () => {
    renderCatalogue();
    expect(items()).toHaveLength(widgetRegistry.size);
    for (const category of CATEGORIES) {
      const count = widgetRegistry.getWidgetsByCategory(category).length;
      if (count === 0) continue;
      const heading = within(catalogue()).getByRole('heading', {
        name: `${CATEGORY_LABELS[category]} ${count}`,
      });
      const section = heading.closest<HTMLElement>('[role="group"]');
      expect(section).not.toBeNull();
      expect(within(section ?? catalogue()).getAllByRole('button')).toHaveLength(count);
    }
    const varGauge = screen.getByTestId('catalogue-item-var-gauge');
    expect(varGauge).toHaveAccessibleDescription(
      widgetRegistry.getWidget('var-gauge')?.description ?? '',
    );
    expect(varGauge.querySelector('svg')).not.toBeNull();
    expect(screen.getByText(`2 / ${MAX_WIDGETS_PER_PAGE}`)).toBeInTheDocument();
  });

  it('prefetches every widget chunk when it opens, and again on reopening', async () => {
    const spies = widgetRegistry.getAllWidgets().map((w) => vi.spyOn(w, 'preload'));
    renderCatalogue();
    await waitFor(() => {
      for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Hide widget catalogue' }));
    expect(store().catalogueOpen).toBe(false);
    expect(items()).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Show widget catalogue' }));
    expect(store().catalogueOpen).toBe(true);
    await waitFor(() => {
      for (const spy of spies) expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  it('does not prefetch while collapsed', async () => {
    store().setCatalogueOpen(false);
    const spies = widgetRegistry.getAllWidgets().map((w) => vi.spyOn(w, 'preload'));
    renderCatalogue();
    await new Promise((resolve) => setTimeout(resolve, 400));
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('filters by search after the debounce and shows a no-match message', async () => {
    renderCatalogue();
    const box = screen.getByRole('searchbox', { name: 'Search widgets' });
    fireEvent.change(box, { target: { value: 'value at risk' } });
    // Debounced: the list has not changed yet.
    expect(items()).toHaveLength(widgetRegistry.size);
    await waitFor(() => expect(items().length).toBeLessThan(widgetRegistry.size));
    expect(screen.getByTestId('catalogue-item-var-gauge')).toBeInTheDocument();
    expect(screen.queryByTestId('catalogue-item-trade-blotter')).toBeNull();

    fireEvent.change(box, { target: { value: 'zzz' } });
    expect(await screen.findByText('No widgets match “zzz”.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(items()).toHaveLength(widgetRegistry.size);
  });

  it('adds a widget on click (undoable)', async () => {
    renderCatalogue();
    fireEvent.click(screen.getByTestId('catalogue-item-var-gauge'));
    expect(typesOnPage()).toEqual(['portfolio-overview', 'nav-performance', 'var-gauge']);
    expect(await screen.findByText('Added Value at Risk')).toBeInTheDocument();
    expect(hasOverlap(desktop())).toBe(false);

    undoLayoutChange();
    expect(typesOnPage()).toEqual(['portfolio-overview', 'nav-performance']);
  });

  it(`stops adding at VITE_MAX_WIDGETS (${MAX_WIDGETS_PER_PAGE})`, () => {
    fillPage();
    renderCatalogue();
    expect(within(catalogue()).getByRole('status')).toHaveTextContent(/Page full/);
    expect(
      screen.getByText(`${MAX_WIDGETS_PER_PAGE} / ${MAX_WIDGETS_PER_PAGE}`),
    ).toBeInTheDocument();
    for (const button of items()) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('draggable', 'false');
    }
    fireEvent.click(screen.getByTestId('catalogue-item-var-gauge'));
    expect(store().pages.performance.itemIds).toHaveLength(MAX_WIDGETS_PER_PAGE);
  });

  it('drags a widget onto the grid and places it where it is dropped', async () => {
    const { container } = renderCatalogue(true);
    const source = screen.getByTestId('catalogue-item-var-gauge');
    const dataTransfer = { setData: vi.fn(), effectAllowed: 'none' };

    fireEvent.dragStart(source, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-meridian-widget', 'var-gauge');
    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(draggedCatalogueWidget()).toBe('var-gauge');

    const grid = container.querySelector('.react-grid-layout');
    if (!grid) throw new Error('grid not rendered');
    // Column 6 of the top row, beside the 4-column overview.
    const at = { clientX: 6 * COL_STEP + 4, clientY: 10 };
    dragAt('dragEnter', grid, at);
    dragAt('dragOver', grid, at);
    // The preview is never stored.
    expect(desktop().map((l) => l.i)).toEqual([OVERVIEW, NAV]);
    dragAt('drop', grid, at);

    expect(typesOnPage()).toEqual(['portfolio-overview', 'nav-performance', 'var-gauge']);
    const added = store().pages.performance.itemIds[2] ?? '';
    expect(desktop().find((l) => l.i === added)).toMatchObject({ x: 6, y: 0, ...VAR_SIZE });
    expect(hasOverlap(desktop())).toBe(false);
    expect(draggedCatalogueWidget()).toBeNull();
    expect(await screen.findByText('Added Value at Risk')).toBeInTheDocument();
    expect(screen.queryByTestId('drag-departure')).toBeNull();
  });

  it('ignores drags that did not start in the catalogue', () => {
    const { container } = renderCatalogue(true);
    const grid = container.querySelector('.react-grid-layout');
    if (!grid) throw new Error('grid not rendered');
    dragAt('dragEnter', grid, { clientX: 20, clientY: 20 });
    dragAt('dragOver', grid, { clientX: 20, clientY: 20 });
    dragAt('drop', grid, { clientX: 20, clientY: 20 });
    expect(store().pages.performance.itemIds).toEqual([OVERVIEW, NAV]);
  });
});

describe('dropWidgetOnPage', () => {
  it('places at the drop cell on desktop and pushes overlapping widgets down', () => {
    const id = dropWidgetOnPage('performance', 'var-gauge', { x: 0, y: 0 });
    expect(id).not.toBeNull();
    expect(desktop().find((l) => l.i === id)).toMatchObject({ x: 0, y: 0, ...VAR_SIZE });
    expect(hasOverlap(desktop())).toBe(false);
  });

  it('places at the drop cell of a tablet layout and finds space on desktop', () => {
    store().setLayouts('performance', {
      ...store().pages.performance.layouts,
      tablet: [item(OVERVIEW, 0, 0, 4, 3), item(NAV, 0, 3, 6, 6)],
    });
    const id = dropWidgetOnPage('performance', 'var-gauge', { x: 3, y: 0 }, 'tablet') ?? '';
    const tablet = store().pages.performance.layouts.tablet ?? [];
    expect(tablet.find((l) => l.i === id)).toMatchObject({ x: 3, y: 0 });
    expect(hasOverlap(tablet)).toBe(false);
    expect(desktop().find((l) => l.i === id)).toBeDefined();
    expect(hasOverlap(desktop())).toBe(false);
  });

  it('refuses unknown types, invalid cells and full pages', () => {
    expect(dropWidgetOnPage('performance', 'no-such-widget', { x: 0, y: 0 })).toBeNull();
    expect(dropWidgetOnPage('performance', 'var-gauge', { x: Number.NaN, y: 0 })).toBeNull();
    fillPage();
    expect(dropWidgetOnPage('performance', 'var-gauge', { x: 0, y: 0 })).toBeNull();
  });
});
