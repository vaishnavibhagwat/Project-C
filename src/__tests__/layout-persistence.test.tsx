import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { compressToEncodedURIComponent } from 'lz-string';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listLayoutShares,
  postLayoutShare,
  resetLayoutShares,
  SIMULATED_USERS,
} from '@/data/shareApi';
import { EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import { AppRouter } from '@/layout/AppRoutes';
import { captureDashboard, loadSavedLayout } from '@/layout/layoutFile';
import { LayoutManager } from '@/layout/LayoutManager';
import { toJSON } from '@/layout/LayoutSerializer';
import { ShareDialog } from '@/layout/ShareDialog';
import { buildLayoutLinkUrl, decodeLayoutLink, encodeLayoutLink } from '@/layout/shareLink';
import { defaultSnapshot, getPageMeta } from '@/registry/pages';
import { applySnapshot, captureSnapshot } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useLayoutStore } from '@/store/layoutStore';
import { flushPendingWrites } from '@/store/storage';
import { useThemeStore } from '@/store/themeStore';
import { useWidgetStore } from '@/store/widgetStore';
import type { PageId } from '@/types';
import { fixture } from './fixtures';
import { renderWithProviders } from './render';

const T0 = '2026-11-14T09:30:00+05:30';
const initial = {
  dashboard: useDashboardStore.getState(),
  widgets: useWidgetStore.getState(),
  layouts: useLayoutStore.getState(),
  theme: useThemeStore.getState(),
};
const fixtureFetcher: EndpointFetcher = (endpoint) => Promise.resolve(fixture(endpoint));

beforeEach(() => {
  useDashboardStore.setState(initial.dashboard, true);
  useWidgetStore.setState(initial.widgets, true);
  useLayoutStore.setState(initial.layouts, true);
  useThemeStore.setState(initial.theme, true);
  resetLayoutShares();
});
afterEach(() => {
  window.location.hash = '';
});

const widgetTypes = (page: PageId) => {
  const { instances } = useWidgetStore.getState();
  return useDashboardStore.getState().pages[page].itemIds.map((id) => instances[id]?.widgetId);
};
const desktop = (page: PageId) =>
  (useDashboardStore.getState().pages[page].layouts.desktop ?? []).map(({ x, y, w, h }) => ({
    x,
    y,
    w,
    h,
  }));

describe('save → reload → load round trip', () => {
  it('a saved layout survives a reload and loads back with the same widgets and positions', async () => {
    // A page that differs from the default: two of its widgets.
    const base = defaultSnapshot('research');
    const keep = base.instances.slice(0, 2);
    const ids = new Set(keep.map((i) => i.instanceId));
    applySnapshot(
      'research',
      {
        ...base,
        instances: keep,
        layouts: { desktop: (base.layouts.desktop ?? []).filter((l) => ids.has(l.i)) },
      },
      true,
    );
    const savedTypes = widgetTypes('research');
    const savedPositions = desktop('research');
    useLayoutStore
      .getState()
      .saveLayout('Two-widget desk', captureSnapshot('research'), T0, 'note');
    flushPendingWrites();

    // "Reload": empty memory, then hydrate from localStorage.
    useLayoutStore.setState(initial.layouts, true);
    expect(useLayoutStore.getState().savedLayouts).toEqual([]);
    await useLayoutStore.persist.rehydrate();
    const [layout] = useLayoutStore.getState().savedLayouts;
    expect(layout).toMatchObject({ name: 'Two-widget desk', description: 'note' });

    applySnapshot('research', defaultSnapshot('research'), true);
    expect(widgetTypes('research')).not.toEqual(savedTypes);
    if (!layout) throw new Error('not restored');
    const outcome = loadSavedLayout(layout, 'research');
    expect(outcome.ok).toBe(true);
    expect(widgetTypes('research')).toEqual(savedTypes);
    expect(desktop('research')).toEqual(savedPositions);
  });
});

describe('mock share API (POST /api/layouts/share)', () => {
  it('stores a share and updates the permission when shared again', async () => {
    const user = SIMULATED_USERS[1]?.id ?? '';
    const first = await postLayoutShare(
      { layoutId: 'layout-1', targetUserId: user, permission: 'readonly' },
      { latencyMs: 0 },
    );
    expect(first).toMatchObject({
      layoutId: 'layout-1',
      targetUserId: user,
      permission: 'readonly',
    });
    const again = await postLayoutShare(
      { layoutId: 'layout-1', targetUserId: user, permission: 'editable' },
      { latencyMs: 0 },
    );
    expect(again.shareId).toBe(first.shareId);
    expect(listLayoutShares('layout-1')).toEqual([again]);
  });

  it('rejects invalid bodies and unknown users', async () => {
    await expect(
      postLayoutShare(
        { layoutId: 'x', targetUserId: 'u-priya', permission: 'owner' },
        { latencyMs: 0 },
      ),
    ).rejects.toThrow(/^400 Bad Request: permission/);
    await expect(
      postLayoutShare(
        { layoutId: 'x', targetUserId: 'u-priya', permission: 'readonly', admin: true },
        { latencyMs: 0 },
      ),
    ).rejects.toThrow(/400 Bad Request/);
    await expect(
      postLayoutShare(
        { layoutId: 'x', targetUserId: 'u-nobody', permission: 'readonly' },
        { latencyMs: 0 },
      ),
    ).rejects.toThrow('404 Not Found: no user u-nobody');
  });

  it('the share dialog shares the loaded layout with a simulated colleague', async () => {
    useLayoutStore.getState().saveLayout('Desk', captureSnapshot('research'), T0);
    renderWithProviders(
      <ShareDialog open onClose={() => undefined} page={getPageMeta('research')} />,
    );
    fireEvent.change(screen.getByLabelText('Colleague'), { target: { value: 'u-kabir' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Can edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    const list = screen.getByRole('list', { name: 'Shared with' });
    await waitFor(() => expect(list).toHaveTextContent('Kabir Shah'));
    expect(list).toHaveTextContent('Can edit');
    expect(screen.getByLabelText('Read-only link')).toHaveDisplayValue(/#\/shared\?layout=/);
  });

  it('asks to save the page first when no layout is loaded', () => {
    renderWithProviders(<ShareDialog open onClose={() => undefined} page={getPageMeta('risk')} />);
    expect(screen.getByText(/Save this page as a layout first/)).toBeInTheDocument();
  });
});

describe('read-only share links (?layout=)', () => {
  it('encodes and decodes a layout', () => {
    const state = captureDashboard('risk');
    const encoded = encodeLayoutLink(state);
    expect(encoded).toMatch(/^[A-Za-z0-9+\-$]+$/);
    const decoded = decodeLayoutLink(encoded);
    if (!decoded.ok) throw new Error(decoded.error);
    expect(decoded.layout.widgets.map((w) => w.widgetId)).toEqual(
      captureSnapshot('risk').instances.map((i) => i.widgetId),
    );
    expect(buildLayoutLinkUrl(encoded, 'http://localhost/app/')).toBe(
      `http://localhost/app/#/shared?layout=${encoded}`,
    );
  });

  it('refuses corrupted, oversized and invalid links', () => {
    expect(decodeLayoutLink('not-lz-data').ok).toBe(false);
    expect(decodeLayoutLink('A'.repeat(200_000))).toMatchObject({
      error: 'This share link is too long.',
    });
    const bad = decodeLayoutLink(compressToEncodedURIComponent('{"version":"1.0.0","id":"x"}'));
    expect(bad.ok).toBe(false);
  });

  it('opens read-only and "Save a copy" adds it to saved layouts without changing the page', async () => {
    const before = widgetTypes('workstation');
    const encoded = encodeLayoutLink({
      ...captureDashboard('risk'),
      meta: { name: 'Priya risk view', createdBy: 'Priya Nair' },
    });
    window.location.hash = `#/shared?layout=${encoded}`;
    renderWithProviders(
      <EndpointFetcherContext.Provider value={fixtureFetcher}>
        <AppRouter />
      </EndpointFetcherContext.Provider>,
    );
    expect(await screen.findByRole('heading', { name: /Priya risk view/ })).toHaveTextContent(
      'read-only shared layout',
    );
    const grid = screen.getByTestId('shared-layout-grid');
    const count = captureSnapshot('risk').instances.length;
    await waitFor(() => expect(within(grid).getAllByRole('region')).toHaveLength(count));
    // Read-only: no layout controls on the widgets.
    expect(within(grid).queryByRole('button', { name: /^Remove|^Settings|^Collapse/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save a copy' }));
    expect(
      await screen.findByText(/^Saved a copy to your Workstation layouts/),
    ).toBeInTheDocument();
    const [copy] = useLayoutStore.getState().savedLayouts;
    expect(copy).toMatchObject({ name: 'Priya risk view (shared copy)', page: 'workstation' });
    expect(useLayoutStore.getState().activeByPage.workstation).toBeUndefined();
    expect(widgetTypes('workstation')).toEqual(before);
  }, 30_000);

  it('shows why a broken link cannot open', async () => {
    window.location.hash = '#/shared?layout=broken';
    renderWithProviders(
      <EndpointFetcherContext.Provider value={fixtureFetcher}>
        <AppRouter />
      </EndpointFetcherContext.Provider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not open this shared layout');
  });
});

describe('import by drag and drop', () => {
  it('a layout file dropped on the Layouts panel is validated and applied', async () => {
    const json = toJSON(captureDashboard('risk'));
    renderWithProviders(
      <LayoutManager open onClose={() => undefined} page={getPageMeta('research')} />,
    );
    const zone = screen.getByTestId('layout-drop-zone');
    const file = new File([json], 'risk.layout.json', { type: 'application/json' });
    const dataTransfer = { types: ['Files'], files: [file], dropEffect: 'none' };
    fireEvent.dragOver(zone, { dataTransfer });
    expect(screen.getByText('Drop a layout file to import it')).toBeInTheDocument();
    act(() => {
      fireEvent.drop(zone, { dataTransfer });
    });
    expect(await screen.findByText(/^Imported “Risk layout”/)).toBeInTheDocument();
    expect(widgetTypes('research')).toEqual(
      captureSnapshot('risk').instances.map((i) => i.widgetId),
    );
  });

  it('an invalid dropped file shows the errors and the recovery options', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithProviders(
      <LayoutManager open onClose={() => undefined} page={getPageMeta('research')} />,
    );
    const zone = screen.getByTestId('layout-drop-zone');
    const file = new File(['{ nope'], 'bad.json', { type: 'application/json' });
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file] } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This is not valid JSON.');
    expect(within(alert).getByRole('button', { name: 'Start fresh' })).toBeInTheDocument();
    expect(
      within(alert).getByRole('button', { name: 'Load last valid layout' }),
    ).toBeInTheDocument();
  });
});
