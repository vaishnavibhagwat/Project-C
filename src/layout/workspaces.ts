import { startTransition } from 'react';
import { applySnapshot, captureSnapshot } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useLayoutStore } from '@/store/layoutStore';
import { toIstIso } from '@/utils/time';
import {
  getPreset,
  presetSnapshot,
  WORKSPACE_PAGE,
  type WorkspacePreset,
  type WorkspacePresetId,
} from './presets';

/**
 * Workspaces: the five presets applied to the Workstation page. Applying one replaces the
 * Workstation layout (undoable), sets the preset's density and remembers which preset is in use,
 * so "Reset to preset" can restore it. The switch runs inside startTransition.
 */
export function applyWorkspace(id: WorkspacePresetId): WorkspacePreset {
  const preset = getPreset(id);
  startTransition(() => {
    applySnapshot(WORKSPACE_PAGE, presetSnapshot(preset), true, `Workspace: ${preset.name}`);
    const dashboard = useDashboardStore.getState();
    dashboard.setDensity(preset.density);
    dashboard.setWorkspace(preset.id);
    // The page now shows the preset, not a saved layout.
    useLayoutStore.getState().setActive(WORKSPACE_PAGE, null);
  });
  return preset;
}

/** Put the current workspace's preset back (layout, settings and density). Null if none. */
export function resetToPreset(): WorkspacePreset | null {
  const id = useDashboardStore.getState().workspace;
  return id === null ? null : applyWorkspace(id);
}

/**
 * Save the Workstation as it is now as "My <preset> workspace" (a saved layout with a new id),
 * and mark it as the page's loaded layout. Returns the layout name.
 */
export function saveAsMyWorkspace(now = Date.now()): string {
  const id = useDashboardStore.getState().workspace;
  const name = id === null ? 'My workspace' : `My ${getPreset(id).name} workspace`;
  useLayoutStore
    .getState()
    .saveLayout(
      name,
      captureSnapshot(WORKSPACE_PAGE),
      toIstIso(now),
      id === null ? 'Saved from the Workstation.' : `Based on the ${getPreset(id).name} preset.`,
    );
  return name;
}
