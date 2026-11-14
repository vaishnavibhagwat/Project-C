import type { PageSnapshot, WidgetInstance } from '@/types';
import { DEFAULT_GRID_CONFIG } from '@/utils/gridLayout';
import { derivativesDesk } from './derivativesDesk';
import { executiveOverview } from './executiveOverview';
import { fixedIncome } from './fixedIncome';
import { portfolioManager } from './portfolioManager';
import { riskCommand } from './riskCommand';
import type { WorkspacePreset, WorkspacePresetId } from './types';

export * from './types';

/** The five workspaces, in picker order. */
export const WORKSPACE_PRESETS: readonly WorkspacePreset[] = [
  executiveOverview,
  portfolioManager,
  riskCommand,
  derivativesDesk,
  fixedIncome,
];

/** Workspaces are applied to the Workstation page. */
export const WORKSPACE_PAGE = 'workstation';

export function getPreset(id: WorkspacePresetId): WorkspacePreset {
  return WORKSPACE_PRESETS.find((p) => p.id === id) ?? executiveOverview;
}

/** The preset as a Workstation snapshot. Instance ids are stable, so re-applying is idempotent. */
export function presetSnapshot(preset: WorkspacePreset): PageSnapshot {
  const instances: WidgetInstance[] = preset.widgets.map((w, n) => ({
    instanceId: `ws-${preset.id}-${n}`,
    widgetId: w.widgetId,
    config: { ...w.config },
    position: { x: w.x, y: w.y, w: w.w, h: w.h },
    title: w.title,
  }));
  return {
    page: WORKSPACE_PAGE,
    instances,
    layouts: { desktop: instances.map((i) => ({ i: i.instanceId, ...i.position })) },
    grid: { ...DEFAULT_GRID_CONFIG },
  };
}
