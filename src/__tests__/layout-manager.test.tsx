import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutManager } from '@/layout/LayoutManager';
import { captureDashboard } from '@/layout/layoutFile';
import { toDocument, toJSON } from '@/layout/LayoutSerializer';
import { defaultSnapshot, getPageMeta } from '@/registry/pages';
import { applySnapshot } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useLayoutStore } from '@/store/layoutStore';
import { useThemeStore } from '@/store/themeStore';
import { useWidgetStore } from '@/store/widgetStore';
import { renderWithProviders } from './render';

/**
 * The Layouts drawer with layout files: export, import, and recovering from an invalid file
 * with "Load last valid layout" or "Start fresh".
 */

const PAGE = 'research';
const initial = {
  dashboard: useDashboardStore.getState(),
  widgets: useWidgetStore.getState(),
  layouts: useLayoutStore.getState(),
  theme: useThemeStore.getState(),
};

const createObjectURL = vi.fn(() => 'blob:layout');

beforeEach(() => {
  createObjectURL.mockClear();
  useDashboardStore.setState(initial.dashboard, true);
  useWidgetStore.setState(initial.widgets, true);
  useLayoutStore.setState(initial.layouts, true);
  useThemeStore.setState(initial.theme, true);
  // jsdom has no object URLs and does not navigate; a download is a no-op here.
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const widgetTypes = () => {
  const { instances } = useWidgetStore.getState();
  return useDashboardStore.getState().pages[PAGE].itemIds.map((id) => instances[id]?.widgetId);
};
const defaultTypes = defaultSnapshot(PAGE).instances.map((i) => i.widgetId);

function renderManager() {
  const view = renderWithProviders(
    <LayoutManager open onClose={() => undefined} page={getPageMeta(PAGE)} />,
  );
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('no file input');
  const upload = (text: string, name = 'layout.json') =>
    fireEvent.change(input, {
      target: { files: [new File([text], name, { type: 'application/json' })] },
    });
  return { ...view, upload };
}

/** The research page with only its news feed: different from the default page. */
function shrinkPage() {
  const snap = defaultSnapshot(PAGE);
  applySnapshot(
    PAGE,
    { ...snap, instances: snap.instances.filter((i) => i.widgetId === 'news-feed') },
    true,
  );
  expect(widgetTypes()).toEqual(['news-feed']);
}

describe('LayoutManager layout files', () => {
  it('shows the validation errors and leaves the page unchanged for an invalid file', async () => {
    shrinkPage();
    const { upload } = renderManager();
    upload(JSON.stringify({ version: '1.0.0', id: 'nope', widgets: 'none' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid layout file. The current layout was not changed.');
    const issues = within(alert).getByRole('list', { name: 'Validation errors' });
    expect(within(issues).getByText('id: Expected a UUID v4')).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Load last valid layout' })).toBeDisabled();
    expect(
      within(alert).getByText(/No earlier valid layout for this page yet/),
    ).toBeInTheDocument();
    expect(widgetTypes()).toEqual(['news-feed']);
  });

  it('says when a file is not JSON at all', async () => {
    const { upload } = renderManager();
    upload('{ not json');
    expect(await screen.findByRole('alert')).toHaveTextContent('This is not valid JSON.');
  });

  it('"Start fresh" resets the page to its default layout', async () => {
    shrinkPage();
    const { upload } = renderManager();
    upload('[]');
    const alert = await screen.findByRole('alert');
    fireEvent.click(within(alert).getByRole('button', { name: 'Start fresh' }));
    expect(widgetTypes()).toEqual(defaultTypes);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('"Load last valid layout" restores the last exported layout', async () => {
    shrinkPage();
    const { upload } = renderManager();
    // Export remembers the news-feed-only page as the last valid layout.
    fireEvent.click(screen.getByRole('button', { name: 'Export layout JSON' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    applySnapshot(PAGE, defaultSnapshot(PAGE), true);

    upload('{"version":"9.0.0"}');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Layout format 9.0.0 is not supported');
    const load = within(alert).getByRole('button', { name: 'Load last valid layout' });
    expect(load).toBeEnabled();
    fireEvent.click(load);
    expect(widgetTypes()).toEqual(['news-feed']);
    expect(
      await screen.findByText(/^Loaded last valid layout “Research layout”/),
    ).toBeInTheDocument();
  });

  it('imports a valid file, theme included, and shows unknown widgets as placeholders', async () => {
    const state = captureDashboard('risk');
    const doc = toDocument(state);
    const [first] = doc.widgets;
    if (!first) throw new Error('empty page');
    const customBefore = useThemeStore.getState().customThemes.length;
    const file = JSON.stringify(
      {
        ...doc,
        name: 'Desk risk view',
        theme: {
          ...doc.theme,
          id: 'desk-theme',
          name: 'Desk',
          tokens: { ...doc.theme.tokens, accent: '#123456' },
        },
        widgets: [
          ...doc.widgets,
          {
            ...first,
            instanceId: 'plugin-1',
            widgetId: 'esg-scorecard',
            position: { desktop: { x: 0, y: 40, w: 4, h: 3 } },
          },
        ],
      },
      null,
      2,
    );
    const { upload } = renderManager();
    upload(file);

    expect(
      await screen.findByText(
        'Imported “Desk risk view” (1 unknown widget shown as a placeholder)',
      ),
    ).toBeInTheDocument();
    expect(widgetTypes()).toEqual([...doc.widgets.map((w) => w.widgetId), 'esg-scorecard']);
    const themes = useThemeStore.getState();
    expect(themes.customThemes).toHaveLength(customBefore + 1);
    expect(themes.customThemes.at(-1)?.tokens.accent).toBe('#123456');
    expect(themes.activeThemeId).toBe(themes.customThemes.at(-1)?.id);
    expect(useLayoutStore.getState().lastValidByPage[PAGE]).toBe(file);
  });

  it('reuses the current theme instead of adding a copy', async () => {
    const json = toJSON(captureDashboard(PAGE));
    const { upload } = renderManager();
    upload(json);
    await screen.findByText(/^Imported “Research layout”/);
    expect(useThemeStore.getState().customThemes).toHaveLength(0);
    expect(useThemeStore.getState().activeThemeId).toBe(initial.theme.activeThemeId);
  });

  it('shows the current layout size against the 50 KB budget', async () => {
    renderManager();
    await waitFor(() =>
      expect(screen.getByText(/^Current layout JSON: \d+\.\d KB of 50 KB/)).toBeInTheDocument(),
    );
  });
});
