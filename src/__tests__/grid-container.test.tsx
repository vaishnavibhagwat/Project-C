import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GridContainer } from '@/grid/GridContainer';
import { GridToolbar } from '@/grid/GridToolbar';
import { EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import { PLACEHOLDER_WIDGET_ID } from '@/registry/placeholder';
import {
  addPlaceholder,
  applySnapshot,
  captureSnapshot,
  fillPlaceholder,
  MAX_WIDGETS_PER_PAGE,
} from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import type { PageId } from '@/types';
import { fixture, gridItem as item, hasOverlap } from './fixtures';
import { renderWithProviders } from './render';

const fixtureFetcher: EndpointFetcher = (endpoint) => Promise.resolve(fixture(endpoint));
const initial = { dashboard: useDashboardStore.getState(), widgets: useWidgetStore.getState() };
const originalWidth = window.innerWidth;
const store = () => useDashboardStore.getState();
const instances = () => useWidgetStore.getState().instances;

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

function renderGrid(page: PageId = 'research') {
  return renderWithProviders(
    <EndpointFetcherContext.Provider value={fixtureFetcher}>
      <GridToolbar page={page} onOpenMarketplace={() => undefined} />
      <GridContainer page={page} />
    </EndpointFetcherContext.Provider>,
  );
}

// Compile the widget chunks once so the first render does not pay the transform cost.
const widgetChunks = import.meta.glob('/src/widgets/*/index.tsx');
beforeAll(async () => {
  await Promise.all(Object.values(widgetChunks).map((load) => load()));
}, 120_000);

beforeEach(() => {
  useDashboardStore.setState(initial.dashboard, true);
  useWidgetStore.setState(initial.widgets, true);
  setViewport(1440);
});
afterEach(() => setViewport(originalWidth));

describe('GridContainer', () => {
  it('renders one GridItem per widget and reports the desktop breakpoint', async () => {
    renderGrid();
    const ids = store().pages.research.itemIds;
    await waitFor(() =>
      expect(document.querySelectorAll('[data-instance-id]')).toHaveLength(ids.length),
    );
    for (const id of ids) {
      expect(
        document.querySelector(`[data-instance-id="${id}"] [data-testid="widget-${id}"]`),
      ).not.toBeNull();
    }
    expect(store().activeBreakpoint).toBe('desktop');
    expect(screen.getByText('Desktop · 12 cols')).toBeInTheDocument();
  });

  it.each([
    [1000, 'tablet', 6, 'Tablet · 6 cols'],
    [500, 'mobile', 1, 'Mobile · 1 col'],
  ] as const)(
    'at %i px uses the %s layout (%i columns) and stores it separately',
    async (width, breakpoint, cols, label) => {
      setViewport(width);
      const desktopBefore = store().pages.research.layouts.desktop;
      renderGrid();
      expect(await screen.findByText(label)).toBeInTheDocument();
      await waitFor(() => expect(store().pages.research.layouts[breakpoint]).toBeDefined());
      const layout = store().pages.research.layouts[breakpoint] ?? [];
      expect(layout).toHaveLength(store().pages.research.itemIds.length);
      expect(Math.max(...layout.map((l) => l.x + l.w))).toBeLessThanOrEqual(cols);
      expect(hasOverlap(layout)).toBe(false);
      if (breakpoint === 'mobile') expect(layout.every((l) => l.x === 0 && l.w === 1)).toBe(true);
      // The desktop layout is untouched.
      expect(store().pages.research.layouts.desktop).toEqual(desktopBefore);
    },
  );

  it('switches compaction from the toolbar', () => {
    renderGrid();
    fireEvent.click(screen.getByRole('radio', { name: 'Free' }));
    expect(store().gridConfig.compaction).toBe('none');
    fireEvent.click(screen.getByRole('radio', { name: 'Packed' }));
    expect(store().gridConfig.compaction).toBe('vertical');
  });
});

describe('Add widget (empty slot)', () => {
  it('places an empty slot at the next free position', () => {
    // Research page: feed (7 wide) and alerts (5 wide) on top, blotter below. Leave a gap.
    store().replacePage('research', {
      itemIds: ['research-research-feed', 'research-trade-blotter'],
      layouts: {
        desktop: [
          item('research-research-feed', 0, 0, 7, 7),
          item('research-trade-blotter', 0, 7, 12, 5),
        ],
      },
    });
    const id = addPlaceholder('research');
    if (!id) throw new Error('expected a slot');
    expect(instances()[id]?.widgetId).toBe(PLACEHOLDER_WIDGET_ID);
    expect(store().pages.research.layouts.desktop?.find((l) => l.i === id)).toEqual(
      item(id, 7, 0, 4, 3),
    );
    expect(hasOverlap(store().pages.research.layouts.desktop ?? [])).toBe(false);
  });

  it('adds a slot from the toolbar and fills it from the slot menu', async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.click(screen.getByRole('button', { name: 'Add widget' }));
    const slot = await screen.findByRole('region', { name: 'Empty widget slot' });
    await user.click(within(slot).getByRole('button', { name: /Choose widget/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Value at Risk' }));
    expect(screen.queryByRole('region', { name: 'Empty widget slot' })).not.toBeInTheDocument();
    const filled = Object.values(instances()).filter((i) => i.widgetId === 'var-gauge');
    expect(filled.some((i) => store().pages.research.itemIds.includes(i.instanceId))).toBe(true);
  });

  it('grows a filled slot to the widget default size and rejects non-slots', () => {
    const id = addPlaceholder('research');
    if (!id) throw new Error('expected a slot');
    expect(fillPlaceholder('research', id, 'trade-blotter')).toBe(true);
    const placed = store().pages.research.layouts.desktop?.find((l) => l.i === id);
    expect(placed).toMatchObject({ w: 12, h: 5 });
    expect(fillPlaceholder('research', id, 'var-gauge')).toBe(false);
    expect(fillPlaceholder('research', 'research-research-feed', 'var-gauge')).toBe(false);
  });

  it('removes a slot with undo, and keeps slots in saved layouts', async () => {
    const user = userEvent.setup();
    const id = addPlaceholder('research');
    if (!id) throw new Error('expected a slot');
    const snapshot = captureSnapshot('research');
    renderGrid();
    const slot = await screen.findByRole('region', { name: 'Empty widget slot' });
    await user.click(within(slot).getByRole('button', { name: 'Remove empty slot' }));
    expect(store().pages.research.itemIds).not.toContain(id);
    act(() => {
      applySnapshot('research', snapshot, true);
    });
    expect(store().pages.research.itemIds).toContain(id);
  });

  it('refuses to add beyond the per-page limit', () => {
    while (store().pages.research.itemIds.length < MAX_WIDGETS_PER_PAGE) addPlaceholder('research');
    expect(addPlaceholder('research')).toBeNull();
  });
});
