import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GridContainer, RESIZE_HANDLES } from '@/grid/GridContainer';
import { PLACEHOLDER_MIN, sizeLimitsFor, withSizeLimits } from '@/grid/sizeLimits';
import { EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import { PLACEHOLDER_WIDGET_ID } from '@/registry/placeholder';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import { DEFAULT_GRID_CONFIG } from '@/utils/gridLayout';
import { fixture, gridItem as item } from './fixtures';
import { renderWithProviders } from './render';

const fixtureFetcher: EndpointFetcher = (endpoint) => Promise.resolve(fixture(endpoint));
const initial = { dashboard: useDashboardStore.getState(), widgets: useWidgetStore.getState() };
const store = () => useDashboardStore.getState();

// jsdom has no layout, so it has no offsetParent; react-grid-layout needs one to start a drag.
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
});

function renderGrid(page: 'research' | 'performance' = 'research') {
  return renderWithProviders(
    <EndpointFetcherContext.Provider value={fixtureFetcher}>
      <GridContainer page={page} />
    </EndpointFetcherContext.Provider>,
  );
}

describe('size limits', () => {
  it("come from each widget's WidgetDefinition, converted to the current grid", () => {
    expect(sizeLimitsFor('portfolio-overview', DEFAULT_GRID_CONFIG)).toEqual({
      min: { w: 4, h: 2 },
      max: { w: 12, h: 3 },
    });
    expect(sizeLimitsFor('var-gauge', DEFAULT_GRID_CONFIG)).toEqual({
      min: { w: 3, h: 4 },
      max: undefined,
    });
    expect(sizeLimitsFor(PLACEHOLDER_WIDGET_ID, DEFAULT_GRID_CONFIG).min).toEqual(PLACEHOLDER_MIN);
    // 24 columns: the same minimum share of the width.
    expect(sizeLimitsFor('var-gauge', { ...DEFAULT_GRID_CONFIG, cols: 24 }).min.w).toBe(6);
  });

  it('are attached to every item and clamp stored sizes outside them', () => {
    const limits = { min: { w: 4, h: 2 }, max: { w: 12, h: 3 } };
    const [tooTall, tooNarrow] = withSizeLimits(
      [item('a', 0, 0, 12, 8), item('b', 10, 3, 1, 1)],
      () => limits,
      12,
    );
    expect(tooTall).toMatchObject({ w: 12, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 3 });
    // Widened to its minimum and moved left so it stays inside the 12 columns.
    expect(tooNarrow).toMatchObject({ x: 8, w: 4, h: 2 });
    // Mobile: one column, so the minimum width becomes 1.
    const [mobile] = withSizeLimits([item('a', 0, 0, 1, 4)], () => limits, 1);
    expect(mobile).toMatchObject({ w: 1, minW: 1, maxW: 1 });
  });
});

describe('GridContainer interaction', () => {
  it('uses CSS transforms, title-bar dragging and resize handles on every corner and edge', async () => {
    renderGrid();
    await waitFor(() => expect(document.querySelectorAll('.react-grid-item')).toHaveLength(3));
    for (const cell of document.querySelectorAll('.react-grid-item')) {
      expect(cell).toHaveClass('cssTransforms');
      const handles = [...cell.querySelectorAll(':scope > .react-resizable-handle')];
      expect(handles.map((h) => h.className.replace(/.*react-resizable-handle-/, ''))).toEqual(
        RESIZE_HANDLES,
      );
    }
    expect(RESIZE_HANDLES).toContain('se');
  });

  it('hides resize handles when the layout is locked', async () => {
    act(() => store().setLocked(true));
    renderGrid();
    await waitFor(() => expect(document.querySelectorAll('.react-grid-item')).toHaveLength(3));
    // react-grid-layout keeps the handles in the DOM and hides them with this class.
    for (const cell of document.querySelectorAll('.react-grid-item')) {
      expect(cell).toHaveClass('react-resizable-hide');
    }
    expect(document.querySelector('.react-grid-layout')).toHaveClass('is-locked');
  });

  it('does not touch the store or re-render widgets while dragging, and commits on drop', async () => {
    renderGrid();
    const id = 'research-alerts-monitor';
    await screen.findByRole('region', { name: 'Alerts' });
    const handle = document.querySelector(`[data-instance-id="${id}"] .widget-drag-handle`);
    if (!(handle instanceof HTMLElement)) throw new Error('no drag handle');
    const pagesBefore = store().pages;
    const before = store().pages.research.layouts.desktop?.find((l) => l.i === id);

    window.__MERIDIAN_PERF__ = [];
    fireEvent.mouseDown(handle, { clientX: 900, clientY: 20, button: 0 });
    fireEvent.mouseMove(document, { clientX: 200, clientY: 20 });
    fireEvent.mouseMove(document, { clientX: 20, clientY: 20 });

    expect(store().pages).toBe(pagesBefore);
    expect(window.__MERIDIAN_PERF__).toEqual([]);
    expect(screen.getByTestId('drag-departure')).toBeInTheDocument();
    expect(document.querySelector('.react-grid-placeholder')).not.toBeNull();

    fireEvent.mouseUp(document, { clientX: 20, clientY: 20 });
    delete window.__MERIDIAN_PERF__;
    expect(screen.queryByTestId('drag-departure')).not.toBeInTheDocument();
    const after = store().pages.research.layouts.desktop?.find((l) => l.i === id);
    expect(after?.x).not.toBe(before?.x);
    expect(store().pages).not.toBe(pagesBefore);
  });

  it('resizes from a corner, stops at the widget maxSize and commits only on release', async () => {
    renderGrid('performance');
    const id = 'performance-portfolio-overview';
    await screen.findByRole('region', { name: 'Portfolio Overview' });
    const se = document.querySelector(`[data-instance-id="${id}"] > .react-resizable-handle-se`);
    if (!(se instanceof HTMLElement)) throw new Error('no se handle');
    const pagesBefore = store().pages;

    fireEvent.mouseDown(se, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.mouseMove(document, { clientX: 100, clientY: 400 });
    fireEvent.mouseMove(document, { clientX: 100, clientY: 900 });
    expect(store().pages).toBe(pagesBefore);
    fireEvent.mouseUp(document, { clientX: 100, clientY: 900 });

    const after = store().pages.performance.layouts.desktop?.find((l) => l.i === id);
    expect(after?.h).toBe(3);
  });
});
