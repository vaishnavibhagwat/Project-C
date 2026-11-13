import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LayoutBrowser, persistMessage, widgetCount } from '@/layout/LayoutBrowser';
import { LayoutManager } from '@/layout/LayoutManager';
import { thumbnailBoxes } from '@/layout/LayoutThumbnail';
import { SaveLayoutDialog } from '@/layout/SaveLayoutDialog';
import { usePersistToasts } from '@/layout/usePersistToasts';
import { defaultSnapshot, getPageMeta } from '@/registry/pages';
import { applySnapshot } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { selectVersions, useLayoutStore } from '@/store/layoutStore';
import { markFailed, markSaved, resetPersistStatus } from '@/store/persistStatus';
import { discardPendingWrites } from '@/store/storage';
import { useWidgetStore } from '@/store/widgetStore';
import type { PageId, PageSnapshot } from '@/types';
import { renderWithProviders } from './render';

const T0 = '2026-11-10T09:15:00+05:30';
const T1 = '2026-11-12T16:40:00+05:30';
const initial = {
  dashboard: useDashboardStore.getState(),
  widgets: useWidgetStore.getState(),
  layouts: useLayoutStore.getState(),
};

beforeEach(() => {
  useDashboardStore.setState(initial.dashboard, true);
  useWidgetStore.setState(initial.widgets, true);
  useLayoutStore.setState(initial.layouts, true);
});

const store = () => useLayoutStore.getState();
const widgetTypes = (page: PageId) => {
  const { instances } = useWidgetStore.getState();
  return useDashboardStore.getState().pages[page].itemIds.map((id) => instances[id]?.widgetId);
};
/** The research page with only some of its widgets. */
function partial(page: PageId, keep: number): PageSnapshot {
  const snap = defaultSnapshot(page);
  const instances = snap.instances.slice(0, keep);
  const ids = new Set(instances.map((i) => i.instanceId));
  return {
    ...snap,
    instances,
    layouts: { desktop: (snap.layouts.desktop ?? []).filter((l) => ids.has(l.i)) },
  };
}
const card = (name: string) => screen.getByRole('listitem', { name });
const renderBrowser = (page: PageId = 'research') =>
  renderWithProviders(<LayoutBrowser page={getPageMeta(page)} />);

describe('LayoutBrowser', () => {
  it('lists saved layouts with name, created date, widget count and a thumbnail', () => {
    store().saveLayout('Morning desk', defaultSnapshot('research'), T0, 'News first');
    renderBrowser();
    const item = card('Morning desk');
    expect(within(item).getByText('News first')).toBeInTheDocument();
    const count = defaultSnapshot('research').instances.length;
    expect(item).toHaveTextContent(`Created 10 Nov 2026, 09:15 IST · ${count} widgets · v1`);
    const thumb = within(item).getByTestId('layout-thumbnail');
    // One rectangle for the background, one per widget.
    expect(thumb.querySelectorAll('rect')).toHaveLength(count + 1);
    expect(thumb).toHaveAttribute('aria-hidden', 'true');
  });

  it('switches between list and grid views', () => {
    store().saveLayout('A', defaultSnapshot('research'), T0);
    renderBrowser();
    expect(screen.getByRole('list', { name: 'Saved layouts, list view' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Grid' }));
    const grid = screen.getByRole('list', { name: 'Saved layouts, grid view' });
    expect(grid).toHaveClass('grid', 'grid-cols-2');
  });

  it('shows this page by default and every page on request, newest first', () => {
    store().saveLayout('Research A', defaultSnapshot('research'), T0);
    store().saveLayout('Risk B', defaultSnapshot('risk'), T1);
    store().saveLayout('Research C', defaultSnapshot('research'), '2026-11-12T17:00:00+05:30');
    renderBrowser();
    const names = () =>
      within(screen.getByRole('list', { name: /^Saved layouts/ }))
        .getAllByRole('listitem')
        .filter((li) => li.parentElement?.getAttribute('aria-label')?.startsWith('Saved layouts'))
        .map((li) => li.getAttribute('aria-label'));
    expect(names()).toEqual(['Research C', 'Research A']);
    fireEvent.click(screen.getByRole('radio', { name: 'All pages' }));
    expect(names()).toEqual(['Research C', 'Risk B', 'Research A']);
    expect(card('Risk B')).toHaveTextContent('· Risk');
  });

  it('loads a layout: validates it, instantiates the widgets and applies their positions', async () => {
    const snap = partial('research', 2);
    store().saveLayout('Two widgets', snap, T0);
    store().setActive('research', null);
    renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Load Two widgets' }));
    expect(await screen.findByText(/^Loaded “Two widgets” v1/)).toBeInTheDocument();
    expect(widgetTypes('research')).toEqual(snap.instances.map((i) => i.widgetId));
    const desktop = useDashboardStore.getState().pages.research.layouts.desktop ?? [];
    expect(desktop.map(({ x, y, w, h }) => ({ x, y, w, h }))).toEqual(
      (snap.layouts.desktop ?? []).map(({ x, y, w, h }) => ({ x, y, w, h })),
    );
    expect(store().activeByPage.research).toBe(store().savedLayouts[0]?.id);
    expect(within(card('Two widgets')).getByText('Loaded')).toBeInTheDocument();
  });

  it('refuses to load a saved layout that fails validation, leaving the page alone', async () => {
    const id = store().saveLayout('Broken', defaultSnapshot('research'), T0);
    useLayoutStore.setState((s) => ({
      savedLayouts: s.savedLayouts.map((l) =>
        l.id === id
          ? {
              ...l,
              versions: l.versions.map((v) => ({
                ...v,
                snapshot: {
                  ...v.snapshot,
                  instances: v.snapshot.instances.map((i) => ({ ...i, widgetId: 'Not Kebab' })),
                },
              })),
            }
          : l,
      ),
    }));
    applySnapshot('research', partial('research', 1), true);
    renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Load Broken' }));
    expect(
      await screen.findByText(/^Could not load “Broken”: widgets\.0\.widgetId/),
    ).toBeInTheDocument();
    expect(widgetTypes('research')).toEqual([partial('research', 1).instances[0]?.widgetId]);
  });

  it('lists versions with Revert on each earlier one', async () => {
    const id = store().saveLayout('Desk', partial('research', 1), T0);
    store().saveVersion(id, partial('research', 3), 'three widgets', T1);
    renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Versions of Desk' }));
    const versions = screen.getByRole('list', { name: 'Versions of Desk (last 10 kept)' });
    expect(within(versions).getByText('Current')).toBeInTheDocument();
    expect(within(versions).queryByRole('button', { name: 'Revert Desk to v2' })).toBeNull();

    fireEvent.click(within(versions).getByRole('button', { name: 'Revert Desk to v1' }));
    expect(await screen.findByText(/^Reverted to v1: “Desk” v3/)).toBeInTheDocument();
    expect(selectVersions(store(), id).map((v) => v.note)).toEqual([
      'Initial save',
      'three widgets',
      'Reverted to v1',
    ]);
    expect(widgetTypes('research')).toEqual(
      partial('research', 1).instances.map((i) => i.widgetId),
    );
  });

  it('saves a layout as a new copy with a new id', () => {
    const id = store().saveLayout('Desk', defaultSnapshot('research'), T0);
    renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Save Desk as a new copy' }));
    expect(card('Desk (copy)')).toBeInTheDocument();
    expect(
      store()
        .savedLayouts.map((l) => l.id)
        .filter((x) => x !== id),
    ).toHaveLength(1);
  });

  it('deletes a layout', () => {
    store().saveLayout('Temp', defaultSnapshot('research'), T0);
    renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Temp' }));
    expect(store().savedLayouts).toEqual([]);
    expect(screen.getByText(/No saved layouts for this page yet/)).toBeInTheDocument();
  });

  it('shows whether layouts are saved in this browser', () => {
    // Resetting the store in beforeEach is a change too: start from a clean status.
    discardPendingWrites();
    resetPersistStatus();
    renderBrowser();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Layouts are saved in this browser automatically.');
    act(() => {
      store().saveLayout('X', defaultSnapshot('research'), T0);
    });
    expect(status).toHaveTextContent('Saving…');
    act(() => markSaved('meridian:layouts', Date.parse('2026-11-13T05:00:00Z')));
    expect(status).toHaveTextContent('Saved in this browser at 10:30:00 IST.');
    act(() => markFailed('meridian:layouts', new DOMException('full', 'QuotaExceededError')));
    expect(status).toHaveTextContent('Browser storage is full');
  });
});

describe('layout browser helpers', () => {
  it('counts widgets without empty slots and maps positions for the thumbnail', () => {
    const snap = defaultSnapshot('risk');
    const id = store().saveLayout(
      'Risk',
      {
        ...snap,
        instances: [
          ...snap.instances,
          {
            instanceId: 'slot',
            widgetId: '__placeholder',
            config: {},
            position: { x: 0, y: 20, w: 4, h: 3 },
          },
        ],
      },
      T0,
    );
    const layout = store().savedLayouts.find((l) => l.id === id);
    if (!layout) throw new Error('not saved');
    expect(widgetCount(layout)).toBe(snap.instances.length);
    const { boxes, cols, rows } = thumbnailBoxes(snap);
    expect(cols).toBe(12);
    expect(boxes).toHaveLength(snap.instances.length);
    expect(rows).toBe(Math.max(...boxes.map((b) => b.y + b.h)));
  });

  it('describes the save status', () => {
    expect(persistMessage({ state: 'pending', savedAt: null, quotaExceeded: false })).toBe(
      'Saving…',
    );
    expect(persistMessage({ state: 'error', savedAt: 1, quotaExceeded: false })).toMatch(
      /^Could not write to browser storage/,
    );
  });
});

describe('Save dialog', () => {
  const page = getPageMeta('research');

  it('saves a new layout with a name and description', async () => {
    renderWithProviders(<SaveLayoutDialog open onClose={() => undefined} page={page} />);
    const dialog = screen.getByRole('dialog', { name: 'Save layout' });
    expect(within(dialog).queryByRole('button', { name: 'Save as new' })).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Evening desk' } });
    fireEvent.change(within(dialog).getByLabelText(/^Description/), {
      target: { value: 'News and alerts' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved “Evening desk”')).toBeInTheDocument();
    expect(store().savedLayouts[0]).toMatchObject({
      name: 'Evening desk',
      description: 'News and alerts',
      page: 'research',
    });
    expect(store().activeByPage.research).toBe(store().savedLayouts[0]?.id);
  });

  it('asks for a name', () => {
    renderWithProviders(<SaveLayoutDialog open onClose={() => undefined} page={page} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a name for the layout.')).toBeInTheDocument();
    expect(store().savedLayouts).toEqual([]);
  });

  it('with a layout loaded, Save adds a version and Save as new creates a separate layout', async () => {
    const id = store().saveLayout('Desk', defaultSnapshot('research'), T0, 'first');
    const { unmount } = renderWithProviders(
      <SaveLayoutDialog open onClose={() => undefined} page={page} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Save “Desk”' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Desk');
    expect(within(dialog).getByLabelText(/^Description/)).toHaveValue('first');
    fireEvent.change(within(dialog).getByLabelText(/^Description/), {
      target: { value: 'second' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved “Desk” as v2')).toBeInTheDocument();
    expect(selectVersions(store(), id)).toHaveLength(2);
    expect(store().savedLayouts[0]?.description).toBe('second');
    unmount();

    renderWithProviders(<SaveLayoutDialog open onClose={() => undefined} page={page} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Desk B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as new' }));
    expect(await screen.findByText('Saved a new layout “Desk B”')).toBeInTheDocument();
    const [first, second] = store().savedLayouts;
    expect(second?.id).not.toBe(first?.id);
    expect(second).toMatchObject({ name: 'Desk B', description: 'second' });
    expect(selectVersions(store(), second?.id ?? '')).toHaveLength(1);
    expect(store().activeByPage.research).toBe(second?.id);
  });

  it('opened from the Layouts drawer, Escape closes only the dialog', async () => {
    renderWithProviders(<LayoutManager open onClose={() => undefined} page={page} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save layout…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save layout' });
    expect(dialog).toContainElement(
      document.activeElement instanceof HTMLElement ? document.activeElement : null,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Save layout' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Layouts · Research' })).toBeInTheDocument();
  });
});

describe('storage-full toast', () => {
  function Probe() {
    usePersistToasts();
    return null;
  }

  it('says once that storage is full, and when saving works again', async () => {
    renderWithProviders(<Probe />);
    const full = new DOMException('full', 'QuotaExceededError');
    act(() => {
      markFailed('meridian:layouts', full);
      markFailed('meridian:widgets', full);
    });
    expect(await screen.findAllByText(/^Browser storage is full\./)).toHaveLength(1);
    act(() => markSaved('meridian:layouts'));
    expect(
      await screen.findByText('Browser storage is working again (saved layouts saved).'),
    ).toBeInTheDocument();
  });
});
