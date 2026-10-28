import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getConnectionState } from '@/data/connection';
import { EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import { routeFromPath, routePath } from '@/hooks/useAppRoute';
import { AppRouter } from '@/layout/AppRoutes';
import { search } from '@/layout/searchIndex';
import { captureSnapshot } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useLayoutStore } from '@/store/layoutStore';
import { buildShareUrl, encodeShare } from '@/store/share';
import { useThemeStore } from '@/store/themeStore';
import { useWidgetStore } from '@/store/widgetStore';
import { defaultSnapshot } from '@/registry/pages';
import { fixture } from './fixtures';
import { renderWithProviders } from './render';

/**
 * Serve validated fixtures captured at a fixed IST time, so these integration tests never
 * depend on the real clock (session phase, how many ticks to simulate) or on machine load.
 */
const fixtureFetcher: EndpointFetcher = (endpoint) => Promise.resolve(fixture(endpoint));

function renderShell() {
  return renderWithProviders(
    <EndpointFetcherContext.Provider value={fixtureFetcher}>
      <AppRouter />
    </EndpointFetcherContext.Provider>,
  );
}

const initial = {
  dashboard: useDashboardStore.getState(),
  widgets: useWidgetStore.getState(),
  layouts: useLayoutStore.getState(),
  theme: useThemeStore.getState(),
};

/** Navigate like the address bar would: HashRouter listens for popstate. */
function goTo(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

// Compile every lazy widget and page chunk once, up front, so the first test that renders one
// does not pay the one-off transform cost (Recharts, D3, react-virtuoso, react-grid-layout)
// inside its own timeout. This matters most under coverage instrumentation.
const lazyChunks = {
  ...import.meta.glob('/src/widgets/*/index.tsx'),
  ...import.meta.glob('/src/layout/pages/*.tsx'),
  ...import.meta.glob('/src/layout/PerformanceOverlay.tsx'),
};
beforeAll(async () => {
  await Promise.all(Object.values(lazyChunks).map((load) => load()));
}, 120_000);

beforeEach(() => {
  useDashboardStore.setState(initial.dashboard, true);
  useWidgetStore.setState(initial.widgets, true);
  useLayoutStore.setState(initial.layouts, true);
  useThemeStore.setState(initial.theme, true);
  goTo('#/workstation');
});

describe('routing helpers', () => {
  it('maps router paths to app routes and back', () => {
    expect(routeFromPath('/risk')).toBe('risk');
    expect(routeFromPath('/settings')).toBe('settings');
    expect(routeFromPath('/unknown')).toBeNull();
    expect(routePath('marketplace', { target: 'risk' })).toBe('/marketplace?target=risk');
  });
});

describe('global search index', () => {
  it('finds symbols, widgets, pages and commands', () => {
    expect(search('reliance')[0]).toMatchObject({ kind: 'symbol', symbol: 'RELIANCE' });
    expect(search('value at risk').some((r) => r.kind === 'widget')).toBe(true);
    expect(search('risk analytics')[0]).toMatchObject({ kind: 'page', route: 'risk' });
    expect(search('outage')[0]).toMatchObject({ kind: 'action', action: 'toggle-outage' });
    expect(search('zzzz')).toEqual([]);
  });
});

describe('AppShell', () => {
  it('renders the workstation: nav rail, command bar, simulated-data label, summary strip and 9 widgets', async () => {
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    // Home mark plus seven destinations.
    expect(within(nav).getAllByRole('link')).toHaveLength(8);
    for (const name of [
      'Workstation',
      'Risk',
      'Holdings',
      'Performance',
      'Research & Alerts',
      'Marketplace',
      'Settings',
    ]) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(nav).getByRole('link', { name: 'Workstation' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('Simulated data')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Portfolio Workstation' }),
    ).toBeInTheDocument();
    await waitFor(
      () => expect(document.querySelectorAll('[data-testid^="widget-"]')).toHaveLength(9),
      { timeout: 5000 },
    );
    const strip = await screen.findByRole(
      'region',
      { name: /^Portfolio summary, as of/ },
      { timeout: 10_000 },
    );
    expect(within(strip).getByText('$45.0B')).toBeInTheDocument();
    expect(within(strip).getAllByRole('term')).toHaveLength(8);
  }, 15_000);

  it('switches between app areas', async () => {
    renderShell();
    goTo('#/risk');
    expect(screen.getByRole('heading', { level: 1, name: 'Risk Analytics' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('region')).toHaveLength(5), {
      timeout: 5000,
    });
    goTo('#/marketplace');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Widget Marketplace' }),
    ).toBeInTheDocument();
    goTo('#/settings');
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });

  it('redirects unknown routes to the workstation', async () => {
    renderShell();
    goTo('#/no-such-page');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Portfolio Workstation' }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/workstation');
  });

  it('switches dashboards from the command-bar selector', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /^Dashboard: Portfolio Workstation/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Holdings Explorer' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Holdings Explorer' }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/holdings');
  });

  it('applies grid settings from the Settings page', async () => {
    renderShell();
    goTo('#/settings');
    const cols = await screen.findByLabelText('Desktop columns');
    fireEvent.change(cols, { target: { value: '30' } });
    expect(screen.getByText('Allowed range is 6 to 24.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    fireEvent.change(cols, { target: { value: '24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(useDashboardStore.getState().gridConfig.cols).toBe(24);
    const lg = useDashboardStore.getState().pages.workstation.layouts.desktop ?? [];
    expect(Math.max(...lg.map((l) => l.x + l.w))).toBe(24);
  });

  it('opens global search with Ctrl+K and shows a symbol detail', async () => {
    renderShell();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = screen.getByRole('combobox', { name: /Search pages, widgets/ });
    fireEvent.change(input, { target: { value: 'RELIANCE' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(
      await screen.findByRole('dialog', { name: /RELIANCE · Reliance Industries/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Quantity', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('adds a widget from the marketplace to the chosen page', async () => {
    renderShell();
    goTo('#/marketplace?target=research');
    const before = useDashboardStore.getState().pages.research.itemIds.length;
    const card = (await screen.findByRole('heading', { name: 'Value at Risk' })).closest('li');
    if (!card) throw new Error('card not found');
    fireEvent.click(within(card).getByRole('button', { name: 'Add to Research' }));
    expect(useDashboardStore.getState().pages.research.itemIds).toHaveLength(before + 1);
    expect(screen.getByText(/Added Value at Risk to Research/)).toBeInTheDocument();
  });

  it('filters the marketplace by category', async () => {
    renderShell();
    goTo('#/marketplace');
    fireEvent.click(await screen.findByRole('button', { name: 'Gauges' }));
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Value at Risk',
    ]);
  });

  it('saves a layout from the Layouts panel', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Layouts' }));
    fireEvent.change(screen.getByLabelText('Save current layout as'), {
      target: { value: 'Morning desk' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(useLayoutStore.getState().savedLayouts[0]?.name).toBe('Morning desk');
    expect(screen.getByText('Morning desk')).toBeInTheDocument();
    expect(screen.getByText(/KB of 50 KB budget/)).toBeInTheDocument();
  });

  it('creates a share link for the current page', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    const box = screen.getByRole('textbox', { name: 'Share link' });
    expect(box).toHaveDisplayValue(/#\/workstation\?share=/);
  });

  it('applies a layout opened from a share link', () => {
    const snapshot = defaultSnapshot('research');
    const url = buildShareUrl(encodeShare(snapshot), 'risk', 'http://localhost/');
    renderShell();
    goTo(new URL(url).hash);
    expect(screen.getByText(/Shared layout for/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply layout' }));
    expect(captureSnapshot('research').instances.map((i) => i.widgetId)).toEqual(
      snapshot.instances.map((i) => i.widgetId),
    );
  });

  it('rejects a corrupted share link with a message', () => {
    renderShell();
    goTo('#/workstation?share=garbage');
    expect(screen.getByRole('alert')).toHaveTextContent(/Could not open shared layout/);
  });

  it('resets the page after confirmation', () => {
    useWidgetStore.getState().updateConfig('workstation-var-gauge', { confidence: '95' });
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset page' }));
    expect(useWidgetStore.getState().instances['workstation-var-gauge']?.config).toEqual({});
  });

  it('locks the layout with the L shortcut and the toolbar button', () => {
    renderShell();
    fireEvent.keyDown(window, { key: 'l' });
    expect(useDashboardStore.getState().locked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Locked' }));
    expect(useDashboardStore.getState().locked).toBe(false);
  });

  it('toggles the performance overlay with Ctrl+Shift+P', async () => {
    renderShell();
    // Query by label: role queries over the whole rendered workstation are slow under load.
    const overlay = () => document.querySelector('section[aria-label="Performance overlay"]');
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(overlay()).not.toBeNull(), { timeout: 5000 });
    fireEvent.keyDown(window, { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true });
    expect(overlay()).toBeNull();
  });

  it('navigates with G then a number', () => {
    renderShell();
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: '3' });
    expect(window.location.hash).toBe('#/holdings');
  });

  it('simulates a feed outage from the command bar', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /Feed live/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Simulate feed outage' }));
    expect(getConnectionState().connected).toBe(false);
    expect(await screen.findAllByText(/Disconnected/)).not.toHaveLength(0);
  });

  it('marks notifications as read', async () => {
    renderShell();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Notifications, \d+ unread/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge all' }));
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(useDashboardStore.getState().acknowledgedAlertIds.length).toBeGreaterThan(0);
  });

  it('offers about, shortcuts and a display-currency preference in the user menu', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'User menu' }));
    fireEvent.click(screen.getByRole('radio', { name: 'USD' }));
    expect(useDashboardStore.getState().displayCurrency).toBe('USD');
    fireEvent.click(screen.getByRole('button', { name: 'About this demo' }));
    expect(screen.getByRole('dialog', { name: 'About this demo' })).toHaveTextContent(/simulated/);
  });
});
