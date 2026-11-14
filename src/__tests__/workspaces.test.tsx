import { act, fireEvent, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlaceholderCard } from '@/grid/PlaceholderCard';
import {
  getPreset,
  presetSnapshot,
  WORKSPACE_PAGE,
  WORKSPACE_PRESET_IDS,
  WORKSPACE_PRESETS,
} from '@/layout/presets';
import { WorkspacePicker } from '@/layout/WorkspacePicker';
import { WorkspaceSelector } from '@/layout/WorkspaceSelector';
import { applyWorkspace, resetToPreset, saveAsMyWorkspace } from '@/layout/workspaces';
import { validateWidgetConfig } from '@/registry/configValidator';
import { isPlaceholder } from '@/registry/placeholder';
import { widgetRegistry } from '@/registry/registry';
import { removeWidgetFromPage } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useLayoutStore } from '@/store/layoutStore';
import { useWidgetStore } from '@/store/widgetStore';
import { hasOverlap } from './fixtures';
import { renderWithProviders } from './render';

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

/** Widget types and desktop positions on the Workstation, in order. */
function workstation() {
  const { instances } = useWidgetStore.getState();
  const page = useDashboardStore.getState().pages[WORKSPACE_PAGE];
  const desktop = new Map((page.layouts.desktop ?? []).map((l) => [l.i, l]));
  return page.itemIds.map((id) => {
    const item = desktop.get(id);
    return {
      widgetId: instances[id]?.widgetId,
      title: instances[id]?.title,
      pos: item ? { x: item.x, y: item.y, w: item.w, h: item.h } : null,
    };
  });
}
const expected = (id: (typeof WORKSPACE_PRESET_IDS)[number]) =>
  getPreset(id).widgets.map((w) => ({
    widgetId: w.widgetId,
    title: w.title,
    pos: { x: w.x, y: w.y, w: w.w, h: w.h },
  }));

describe('workspace presets', () => {
  it('has five presets, each with its own widget set or arrangement', () => {
    expect(WORKSPACE_PRESETS.map((p) => p.id)).toEqual([...WORKSPACE_PRESET_IDS]);
    const signatures = WORKSPACE_PRESETS.map((p) =>
      p.widgets.map((w) => `${w.widgetId}@${w.x},${w.y},${w.w}x${w.h}`).join('|'),
    );
    expect(new Set(signatures).size).toBe(5);
    expect(WORKSPACE_PRESETS.map((p) => p.density)).toContain('compact');
  });

  it.each(WORKSPACE_PRESETS.map((p) => [p.name, p] as const))(
    '%s uses real widgets, valid settings and a 12-column layout without overlaps',
    (_name, preset) => {
      for (const w of preset.widgets) {
        if (isPlaceholder(w.widgetId)) continue;
        const entry = widgetRegistry.getWidget(w.widgetId);
        expect(entry, w.widgetId).toBeDefined();
        if (!entry) continue;
        const merged = { ...entry.defaultConfig, ...w.config };
        expect(validateWidgetConfig(merged, entry.configSchema).errors).toEqual([]);
        expect(w.w).toBeGreaterThanOrEqual(entry.minSize.w);
        expect(w.h).toBeGreaterThanOrEqual(entry.minSize.h);
        if (entry.maxSize) {
          expect(w.w).toBeLessThanOrEqual(entry.maxSize.w);
          expect(w.h).toBeLessThanOrEqual(entry.maxSize.h);
        }
      }
      const desktop = presetSnapshot(preset).layouts.desktop ?? [];
      for (const item of desktop) expect(item.x + item.w).toBeLessThanOrEqual(12);
      expect(hasOverlap(desktop)).toBe(false);
    },
  );

  it('the Fixed Income yield and duration panels are labelled placeholders', () => {
    const slots = getPreset('fixed-income').widgets.filter((w) => isPlaceholder(w.widgetId));
    expect(slots.map((w) => w.title)).toEqual([
      'Yield curve (placeholder)',
      'Duration & DV01 (placeholder)',
    ]);
    applyWorkspace('fixed-income');
    const page = useDashboardStore.getState().pages[WORKSPACE_PAGE];
    const slotId = page.itemIds.find((id) =>
      isPlaceholder(useWidgetStore.getState().instances[id]?.widgetId ?? ''),
    );
    renderWithProviders(<PlaceholderCard page={WORKSPACE_PAGE} instanceId={slotId ?? ''} />);
    const region = screen.getByRole('region', { name: 'Yield curve (placeholder)' });
    expect(region).toHaveTextContent('Not available: the simulated dataset has no bond yields.');
  });
});

describe('switching workspaces', () => {
  it.each([...WORKSPACE_PRESET_IDS])('%s loads and persists after a reload', async (id) => {
    applyWorkspace(id);
    const preset = getPreset(id);
    expect(workstation()).toEqual(expected(id));
    expect(useDashboardStore.getState()).toMatchObject({ workspace: id, density: preset.density });

    // "Reload": empty memory, then hydrate both stores from what is in localStorage. Resetting
    // the stores writes too, so put the saved values back first.
    const saved = ['meridian:dashboard', 'meridian:widgets'].map(
      (key) => [key, localStorage.getItem(key) ?? ''] as const,
    );
    useDashboardStore.setState(initial.dashboard, true);
    useWidgetStore.setState(initial.widgets, true);
    for (const [key, value] of saved) localStorage.setItem(key, value);
    expect(workstation()).not.toEqual(expected(id));
    await useDashboardStore.persist.rehydrate();
    await useWidgetStore.persist.rehydrate();
    expect(workstation()).toEqual(expected(id));
    expect(useDashboardStore.getState()).toMatchObject({ workspace: id, density: preset.density });
    const { instances } = useWidgetStore.getState();
    const configs = useDashboardStore
      .getState()
      .pages[WORKSPACE_PAGE].itemIds.map((i) => instances[i]?.config);
    expect(configs).toEqual(preset.widgets.map((w) => ({ ...w.config })));
  });

  it('Reset to preset puts the preset back after changes', () => {
    applyWorkspace('risk-command');
    const [first] = useDashboardStore.getState().pages[WORKSPACE_PAGE].itemIds;
    removeWidgetFromPage(WORKSPACE_PAGE, first ?? '');
    expect(workstation()).toHaveLength(3);
    expect(resetToPreset()?.id).toBe('risk-command');
    expect(workstation()).toEqual(expected('risk-command'));
  });

  it('Reset to preset does nothing before a workspace is chosen', () => {
    expect(resetToPreset()).toBeNull();
  });

  it('Save as my workspace saves the Workstation as a named layout', () => {
    applyWorkspace('derivatives-desk');
    expect(saveAsMyWorkspace()).toBe('My Derivatives Desk workspace');
    const [layout] = useLayoutStore.getState().savedLayouts;
    expect(layout).toMatchObject({
      name: 'My Derivatives Desk workspace',
      page: WORKSPACE_PAGE,
      description: 'Based on the Derivatives Desk preset.',
    });
    expect(layout?.versions[0]?.snapshot.instances.map((i) => i.widgetId)).toEqual(
      getPreset('derivatives-desk').widgets.map((w) => w.widgetId),
    );
  });

  it('the dashboard menu switches workspace, saves it and resets it', () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/research']}>
        <WorkspaceSelector page="research" onManageLayouts={() => undefined} />
      </MemoryRouter>,
    );
    const open = () => fireEvent.click(screen.getByRole('button', { name: /^Dashboard:/ }));
    open();
    expect(screen.getByRole('menuitem', { name: /Reset to preset/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Portfolio Manager/ }));
    expect(useDashboardStore.getState().workspace).toBe('portfolio-manager');
    expect(workstation()).toEqual(expected('portfolio-manager'));

    open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save as my workspace' }));
    expect(useLayoutStore.getState().savedLayouts[0]?.name).toBe('My Portfolio Manager workspace');
  });
});

describe('workspace picker', () => {
  it('shows five cards; choosing one applies it and ends the first run', () => {
    let chosen: string | null = null;
    renderWithProviders(
      <WorkspacePicker open onClose={() => undefined} onChosen={(id) => (chosen = id)} />,
    );
    const list = screen.getByRole('list', { name: 'Workspaces' });
    expect(within(list).getAllByRole('button')).toHaveLength(5);
    expect(within(list).getAllByTestId('layout-thumbnail')).toHaveLength(5);
    act(() => {
      fireEvent.click(within(list).getByRole('button', { name: /^Risk Command:/ }));
    });
    expect(chosen).toBe('risk-command');
    expect(useDashboardStore.getState()).toMatchObject({
      workspace: 'risk-command',
      firstRunDone: true,
    });
    expect(workstation()).toEqual(expected('risk-command'));
  });

  it('can be skipped without changing the Workstation', () => {
    const before = workstation();
    let closed = false;
    renderWithProviders(<WorkspacePicker open onClose={() => (closed = true)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(closed).toBe(true);
    expect(useDashboardStore.getState()).toMatchObject({ firstRunDone: true, workspace: null });
    expect(workstation()).toEqual(before);
  });
});
