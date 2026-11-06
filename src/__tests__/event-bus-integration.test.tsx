import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { VirtuosoMockContext } from 'react-virtuoso';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GridContainer } from '@/grid/GridContainer';
import { clearPendingReveal, FLASH_MS, pendingRevealFor, requestReveal } from '@/grid/revealWidget';
import { EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import { useAlertNavigation } from '@/layout/useAlertNavigation';
import { eventBus } from '@/registry/eventBus';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import type { PageId } from '@/types';
import AttributionBarChart from '@/widgets/attribution-bar-chart';
import { attributionBarChartDefinition } from '@/widgets/attribution-bar-chart/config';
import { fixtureData as attributionData } from '@/widgets/attribution-bar-chart/__tests__';
import HoldingsTable from '@/widgets/holdings-table';
import { holdingsTableDefinition } from '@/widgets/holdings-table/config';
import { sortedHoldings } from '@/widgets/holdings-table/model';
import { fixtureData as holdingsData } from '@/widgets/holdings-table/__tests__';
import NewsFeed from '@/widgets/news-feed';
import { newsFeedDefinition } from '@/widgets/news-feed/config';
import { fixtureData as newsData } from '@/widgets/news-feed/__tests__';
import PerformanceLineChart, { DATE_RANGE_DEBOUNCE_MS } from '@/widgets/performance-line-chart';
import { performanceLineChartDefinition } from '@/widgets/performance-line-chart/config';
import { fixtureData as performanceData } from '@/widgets/performance-line-chart/__tests__';
import PortfolioPieChart from '@/widgets/portfolio-pie-chart';
import { portfolioPieChartDefinition } from '@/widgets/portfolio-pie-chart/config';
import { buildLevel, sliceIndexForSymbol } from '@/widgets/portfolio-pie-chart/model';
import { fixtureData as pieData } from '@/widgets/portfolio-pie-chart/__tests__';
import { fixture, gridItem } from './fixtures';
import { renderWithProviders, widgetProps } from './render';

// Several chart widgets render at once here, which is slow in jsdom; those tests allow 20 s.

/**
 * Cross-widget wiring through the real event bus: the publishing widget and the listening
 * widgets are rendered together, and only the bus connects them.
 */

const pie = pieData();
const pieConfig = portfolioPieChartDefinition.defaultConfig;
const legend = () => screen.getByRole('list', { name: /allocation$/ });
const currentSlice = () =>
  within(legend())
    .queryAllByRole('listitem')
    .map((li) => li.querySelector('[aria-current="true"]'))
    .find((el) => el !== null);

const alertAbout = (relatedWidget: string) => ({
  alertId: 'test-alert',
  relatedWidget,
  relatedEntity: 'PORTFOLIO',
});

/** Each widget gets its own instance id, as on the grid. */
const props = <C, D>(id: string, config: C, data: D, w = 800, h = 400) => ({
  ...widgetProps(config, data, w, h),
  instanceId: id,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SYMBOL_SELECTED → W01 portfolio pie chart', () => {
  it('publishing SYMBOL_SELECTED changes which slice W01 highlights', () => {
    const stock = pie.holdings.find((h) => h.assetClass === 'Equity');
    if (!stock) throw new Error('fixture has no equity');
    const level = buildLevel(pie, pieConfig, []);
    const index = sliceIndexForSymbol(pie, level, stock.ticker);
    const slice = index === null ? undefined : level.slices[index];
    if (!slice) throw new Error('no slice for the ticker');

    renderWithProviders(<PortfolioPieChart {...props('w01', pieConfig, pie)} />);
    expect(currentSlice()).toBeUndefined();
    expect(screen.queryByTestId('selected-symbol')).not.toBeInTheDocument();

    act(() => eventBus.publish('SYMBOL_SELECTED', { ticker: stock.ticker, source: 'w04' }));
    expect(currentSlice()).toHaveTextContent(slice.label);
    expect(currentSlice()).toHaveClass('bg-raised');
    expect(screen.getByTestId('selected-symbol')).toHaveTextContent(stock.ticker);

    fireEvent.click(screen.getByRole('button', { name: `Clear the ${stock.ticker} highlight` }));
    expect(currentSlice()).toBeUndefined();
  });

  it('ignores its own SYMBOL_SELECTED and stops listening once unmounted', () => {
    const before = eventBus.listenerCount('SYMBOL_SELECTED');
    const ticker = pie.holdings[0]?.ticker ?? '';
    const { unmount } = renderWithProviders(
      <PortfolioPieChart {...props('w01', pieConfig, pie)} />,
    );
    expect(eventBus.listenerCount('SYMBOL_SELECTED')).toBe(before + 1);
    act(() => eventBus.publish('SYMBOL_SELECTED', { ticker, source: 'w01' }));
    expect(currentSlice()).toBeUndefined();
    unmount();
    expect(eventBus.listenerCount('SYMBOL_SELECTED')).toBe(before);
  });
});

describe('W04 row click → W01 highlight and W05 ticker filter', () => {
  it('a holdings row click highlights the pie slice and filters the news feed', () => {
    const holdings = holdingsData();
    const tableConfig = holdingsTableDefinition.defaultConfig;
    const top = sortedHoldings(holdings.holdings, tableConfig)[0];
    if (!top) throw new Error('no rows');

    renderWithProviders(
      <>
        <VirtuosoMockContext.Provider value={{ viewportHeight: 600, itemHeight: 32 }}>
          <HoldingsTable {...props('w04', tableConfig, holdings, 1000, 600)} />
        </VirtuosoMockContext.Provider>
        <PortfolioPieChart {...props('w01', pieConfig, pie)} />
        <NewsFeed {...props('w05', newsFeedDefinition.defaultConfig, newsData())} />
      </>,
    );
    fireEvent.click(screen.getByRole('row', { name: `Open ${top.ticker} details` }));

    expect(screen.getByTestId('selected-symbol')).toHaveTextContent(top.ticker);
    expect(currentSlice()).toBeDefined();
    const chip = screen.getByRole('button', { name: `Show all news, not only ${top.ticker}` });
    expect(screen.getByText('Showing news for')).toBeInTheDocument();

    // The clear-filter chip brings every story back.
    fireEvent.click(chip);
    expect(screen.queryByText('Showing news for')).not.toBeInTheDocument();
  }, 20_000);
});

describe('W02 date range → DATE_RANGE_CHANGED → W09', () => {
  it('panning the performance chart gives the attribution chart a "Selected range" period', () => {
    vi.useFakeTimers();
    renderWithProviders(
      <>
        <PerformanceLineChart
          {...props('w02', performanceLineChartDefinition.defaultConfig, performanceData())}
        />
        <AttributionBarChart
          {...props(
            'w09',
            attributionBarChartDefinition.defaultConfig,
            attributionData(),
            640,
            300,
          )}
        />
      </>,
    );
    expect(screen.queryByRole('button', { name: /^Period: Selected range/ })).toBeNull();

    const chart = screen.getByRole('group', { name: /^Performance chart/ });
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    act(() => {
      vi.advanceTimersByTime(DATE_RANGE_DEBOUNCE_MS + 10);
    });
    expect(screen.getByRole('button', { name: /^Period: Selected range/ })).toBeInTheDocument();
  }, 20_000);
});

describe('W06 ALERT_CLICKED → the grid reveals the related widget', () => {
  const OVERVIEW = 'performance-portfolio-overview';
  const NAV = 'performance-nav-performance';
  const fetcher: EndpointFetcher = (endpoint) => Promise.resolve(fixture(endpoint));
  const initial = { dashboard: useDashboardStore.getState(), widgets: useWidgetStore.getState() };

  beforeAll(async () => {
    await Promise.all([
      import('@/widgets/portfolio-overview'),
      import('@/widgets/nav-performance'),
    ]);
  });
  beforeEach(() => {
    useDashboardStore.setState(initial.dashboard, true);
    useWidgetStore.setState(initial.widgets, true);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    useDashboardStore.getState().replacePage('performance', {
      itemIds: [OVERVIEW, NAV],
      layouts: { desktop: [gridItem(OVERVIEW, 0, 0, 4, 3), gridItem(NAV, 0, 3, 8, 6)] },
    });
  });

  const renderGrid = () =>
    renderWithProviders(
      <EndpointFetcherContext.Provider value={fetcher}>
        <GridContainer page="performance" />
      </EndpointFetcherContext.Provider>,
    );
  const cell = (id: string) => document.querySelector<HTMLElement>(`[data-instance-id="${id}"]`);

  it('scrolls the widget into view, focuses its region and flashes its border', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderGrid();
    const nav = cell(NAV);
    if (!nav) throw new Error('NAV cell not rendered');
    expect(nav).not.toHaveAttribute('data-flash');

    act(() => eventBus.publish('ALERT_CLICKED', alertAbout('nav-performance')));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(nav);
    expect(document.activeElement).toBe(within(nav).getAllByRole('region')[0]);
    expect(nav).toHaveAttribute('data-flash', 'true');
    expect(nav).toHaveClass('widget-flash');
    expect(cell(OVERVIEW)).not.toHaveAttribute('data-flash');

    await waitFor(() => expect(nav).not.toHaveAttribute('data-flash'), {
      timeout: FLASH_MS + 1000,
    });
    scroll.mockRestore();
  });

  it('leaves a widget that is not on this page alone (the app shell handles it)', () => {
    renderGrid();
    act(() => eventBus.publish('ALERT_CLICKED', alertAbout('var-gauge')));
    expect(document.querySelector('[data-flash]')).toBeNull();
  });

  it('completes a reveal requested before the page was shown', async () => {
    requestReveal(NAV);
    renderGrid();
    const nav = cell(NAV);
    if (!nav) throw new Error('NAV cell not rendered');
    await waitFor(() => expect(nav).toHaveAttribute('data-flash', 'true'));
    expect(document.activeElement).toBe(within(nav).getAllByRole('region')[0]);
    expect(pendingRevealFor([NAV])).toBeNull();
  });
});

describe('ALERT_CLICKED → the app shell opens the page with the widget', () => {
  const initial = { dashboard: useDashboardStore.getState(), widgets: useWidgetStore.getState() };
  beforeEach(() => {
    useDashboardStore.setState(initial.dashboard, true);
    useWidgetStore.setState(initial.widgets, true);
    clearPendingReveal();
  });

  function Probe() {
    useAlertNavigation();
    return <p data-testid="path">{useLocation().pathname}</p>;
  }
  const renderAt = (path: string) =>
    renderWithProviders(
      <MemoryRouter initialEntries={[path]}>
        <Probe />
      </MemoryRouter>,
    );
  const instanceOn = (page: PageId, widgetId: string) => {
    const { instances } = useWidgetStore.getState();
    return useDashboardStore
      .getState()
      .pages[page].itemIds.find((id) => instances[id]?.widgetId === widgetId);
  };

  it('switches to the first page that has the widget and asks its grid to reveal it', async () => {
    const target = instanceOn('risk', 'risk-contribution');
    if (!target) throw new Error('default Risk page has no risk-contribution widget');
    renderAt('/research');
    act(() => eventBus.publish('ALERT_CLICKED', alertAbout('risk-contribution')));
    expect(screen.getByTestId('path')).toHaveTextContent('/risk');
    expect(pendingRevealFor([target])).toBe(target);
    expect(await screen.findByText(/^Opened Risk Analytics to show/)).toBeInTheDocument();
  });

  it('stays put when the current page has the widget', () => {
    expect(instanceOn('risk', 'var-gauge')).toBeDefined();
    renderAt('/risk');
    act(() => eventBus.publish('ALERT_CLICKED', alertAbout('var-gauge')));
    expect(screen.getByTestId('path')).toHaveTextContent('/risk');
    expect(pendingRevealFor([instanceOn('risk', 'var-gauge') ?? ''])).toBeNull();
  });

  it('says so when no page has the widget', async () => {
    renderAt('/research');
    act(() => eventBus.publish('ALERT_CLICKED', alertAbout('sector-attribution')));
    expect(await screen.findByText(/is not on any page\./)).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/research');
  });
});
