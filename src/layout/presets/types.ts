import type { Density } from '@/theme/tokens';
import type { WorkspacePresetId } from '@/store/schemas';
import type { WidgetConfig } from '@/types';

export { WORKSPACE_PRESET_IDS, type WorkspacePresetId } from '@/store/schemas';

/**
 * One widget in a preset, on the default grid (12 columns, 60 px rows). `config` overrides the
 * widget's defaults. `__placeholder` is an empty slot; its title and `note` say what belongs
 * there.
 */
export interface PresetWidget {
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  config?: WidgetConfig;
}

/** A workspace: a Workstation layout for one kind of user, with its own density. */
export interface WorkspacePreset {
  id: WorkspacePresetId;
  name: string;
  /** Who it is for, one line (picker cards). */
  audience: string;
  description: string;
  density: Density;
  widgets: PresetWidget[];
}
