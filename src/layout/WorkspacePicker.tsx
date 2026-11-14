import { useMemo } from 'react';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Overlay';
import { useToast } from '@/components/Toast';
import { useDashboardStore } from '@/store/dashboardStore';
import { cx } from '@/utils/cx';
import { LayoutThumbnail } from './LayoutThumbnail';
import { presetSnapshot, WORKSPACE_PRESETS, type WorkspacePresetId } from './presets';
import { applyWorkspace } from './workspaces';

/**
 * Choose one of the five workspaces. Shown once on first run (skippable) and from Settings.
 * Either choice or Skip marks the first run as done.
 */
export function WorkspacePicker({
  open,
  onClose,
  onChosen,
}: {
  open: boolean;
  onClose: () => void;
  /** After a workspace is applied (e.g. to open the Workstation). */
  onChosen?: (id: WorkspacePresetId) => void;
}) {
  const current = useDashboardStore((s) => s.workspace);
  const notify = useToast();
  const snapshots = useMemo(
    () => new Map(WORKSPACE_PRESETS.map((p) => [p.id, presetSnapshot(p)])),
    [],
  );
  const finish = () => {
    useDashboardStore.getState().setFirstRunDone(true);
    onClose();
  };
  const choose = (id: WorkspacePresetId) => {
    const preset = applyWorkspace(id);
    notify({ message: `Workspace: ${preset.name}`, tone: 'success' });
    finish();
    onChosen?.(id);
  };

  return (
    <Modal
      open={open}
      onClose={finish}
      title="Choose a workspace"
      description="A starting layout for the Workstation. You can switch any time from the dashboard menu or Settings."
      actions={
        <Button variant="ghost" onClick={finish}>
          Skip for now
        </Button>
      }
    >
      <ul aria-label="Workspaces" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {WORKSPACE_PRESETS.map((preset) => {
          const snapshot = snapshots.get(preset.id);
          const active = preset.id === current;
          return (
            <li key={preset.id}>
              <button
                type="button"
                onClick={() => choose(preset.id)}
                aria-label={`${preset.name}: ${preset.description}`}
                aria-current={active || undefined}
                className={cx(
                  'flex h-full w-full flex-col gap-2 rounded border p-2 text-left hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus',
                  active ? 'border-accent bg-accent/5' : 'border-line',
                )}
              >
                {snapshot ? (
                  <LayoutThumbnail
                    snapshot={snapshot}
                    className="aspect-[4/3] w-full rounded border border-line"
                  />
                ) : null}
                <span className="text-sm font-semibold text-fg">
                  {preset.name}
                  {active ? <span className="ml-1 text-2xs text-accent">(current)</span> : null}
                </span>
                <span className="text-2xs uppercase tracking-wide text-subtle">
                  {preset.audience} · {preset.widgets.length} panels · {preset.density}
                </span>
                <span className="text-xs text-muted">{preset.description}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
