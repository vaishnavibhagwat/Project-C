import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GridContainer } from '@/grid/GridContainer';
import { GridToolbar } from '@/grid/GridToolbar';
import { EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import type { GridItemLayout } from '@/types';
import { fixture, gridItem as item, hasOverlap } from './fixtures';
import { renderWithProviders } from './render';

/**
 * Drag, resize, add and remove through the real GridContainer (react-grid-layout) with mouse
 * events, then read the result from DashboardStore.
 *
 * Geometry in jsdom: the test ResizeObserver reports an 800 px wide grid, so with 12 columns
 * and 8 px gaps one column step is (800 - 11 × 8) / 12 + 8 ≈ 67.3 px, and one row step is
 * 60 + 8 = 68 px.
 */
const COL_STEP = (800 - 11 * 8) / 12 + 8;
const ROW_STEP = 68;

const fixtureFetcher: EndpointFetcher = (endpoint) => Promise.resolve(fixture(endpoint));
const initial = { dashboard: useDashboardStore.getState(), widgets: useWidgetStore.getState() };
const store = () => useDashboardStore.getState();
const desktop = (): GridItemLayout[] => store().pages.performance.layouts.desktop ?? [];
const find = (id: string) => desktop().find((l) => l.i === id);

const OVERVIEW = 'performance-portfolio-overview'; // minSize 4 × 2, maxSize 12 × 3
const NAV = 'performance-nav-performance';

// jsdom has no layout, hence no offsetParent; react-grid-layout needs one to start a drag.
const offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
const widgetChunks = import.meta.glob('/src/widgets/*/index.tsx');
beforeAll(async () => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentElement;
    },
  });
  await Promise.all(Object.values(widgetChunks).map((load) => load()));
}, 120_000);
afterAll(() => {
  if (offsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParent);
});

beforeEach(() => {
  useDashboardStore.setState(initial.dashboard, true);
  useWidgetStore.setState(initial.widgets, true);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  // Performance page reduced to two widgets: a 4 × 3 overview at (0,0) and NAV below it.
  store().replacePage('performance', {
    itemIds: [OVERVIEW, NAV],
    layouts: { desktop: [item(OVERVIEW, 0, 0, 4, 3), item(NAV, 0, 3, 8, 6)] },
  });
});

function renderGrid() {
  return renderWithProviders(
    <EndpointFetcherContext.Provider value={fixtureFetcher}>
      <main id="main" tabIndex={-1}>
        <GridToolbar page="performance" onOpenMarketplace={() => undefined} />
        <GridContainer page="performance" />
      </main>
    </EndpointFetcherContext.Provider>,
  );
}

/** Press on `target`, move by (dx, dy) in a few steps, release. */
function dragBy(target: Element, dx: number, dy: number) {
  const start = { clientX: 100, clientY: 100 };
  fireEvent.mouseDown(target, { ...start, button: 0 });
  for (const f of [0.25, 0.5, 0.75, 1]) {
    fireEvent.mouseMove(document, {
      clientX: start.clientX + dx * f,
      clientY: start.clientY + dy * f,
    });
  }
  fireEvent.mouseUp(document, { clientX: start.clientX + dx, clientY: start.clientY + dy });
}

function part(id: string, selector: string): HTMLElement {
  const el = document.querySelector(`[data-instance-id="${id}"] ${selector}`);
  if (!(el instanceof HTMLElement)) throw new Error(`${selector} not found for ${id}`);
  return el;
}

describe('grid integration', () => {
  it('drags a widget from (0,0) to (2,0) and stores the new layout', async () => {
    renderGrid();
    await screen.findByRole('region', { name: 'Portfolio Overview' });
    expect(find(OVERVIEW)).toEqual(item(OVERVIEW, 0, 0, 4, 3));

    dragBy(part(OVERVIEW, '.widget-drag-handle'), 2 * COL_STEP, 0);

    expect(find(OVERVIEW)).toEqual(item(OVERVIEW, 2, 0, 4, 3));
    expect(hasOverlap(desktop())).toBe(false);
  });

  it('resizes from 4×3 towards 6×4, keeping within the widget min and max size', async () => {
    renderGrid();
    await screen.findByRole('region', { name: 'Portfolio Overview' });
    const se = () => part(OVERVIEW, '> .react-resizable-handle-se');

    // 6 × 4 asked for; the overview's maxSize height is 3, so it becomes 6 × 3.
    dragBy(se(), 2 * COL_STEP, ROW_STEP);
    expect(find(OVERVIEW)).toMatchObject({ w: 6, h: 3 });

    // Far below the minimum (4 × 2): stops at the minimum.
    dragBy(se(), -6 * COL_STEP, -4 * ROW_STEP);
    expect(find(OVERVIEW)).toMatchObject({ w: 4, h: 2 });
    expect(hasOverlap(desktop())).toBe(false);
  });

  it('adds a widget at the next free position and removes it after confirmation', async () => {
    const user = userEvent.setup();
    renderGrid();
    await screen.findByRole('region', { name: 'Portfolio Overview' });

    // Add: an empty slot goes into the first gap (right of the overview), then becomes a widget.
    await user.click(screen.getByRole('button', { name: 'Add widget' }));
    const slot = await screen.findByRole('region', { name: 'Empty widget slot' });
    const slotId = slot.closest('[data-instance-id]')?.getAttribute('data-instance-id') ?? '';
    expect(find(slotId)).toMatchObject({ x: 4, y: 0, w: 4, h: 3 });
    await user.click(within(slot).getByRole('button', { name: /Choose widget/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Value at Risk' }));
    expect(useWidgetStore.getState().instances[slotId]?.widgetId).toBe('var-gauge');
    expect(store().pages.performance.itemIds).toEqual([OVERVIEW, NAV, slotId]);
    const gauge = await screen.findByRole('region', { name: 'Value at Risk' });

    // Remove: the header X asks first; Remove takes it off the page and the store.
    await user.click(within(gauge).getByRole('button', { name: 'Remove Value at Risk' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(store().pages.performance.itemIds).toEqual([OVERVIEW, NAV]);
    expect(find(slotId)).toBeUndefined();
    expect(useWidgetStore.getState().instances[slotId]).toBeUndefined();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Value at Risk' })).not.toBeInTheDocument(),
    );
  });
});
