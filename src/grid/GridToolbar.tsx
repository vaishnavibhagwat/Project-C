import { Button, IconButton } from '@/components/Button';
import { Segmented } from '@/components/FormControls';
import { IconPencil, IconPlus, IconRedo, IconStore, IconUndo } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { addPlaceholder, applyGridConfig, MAX_WIDGETS_PER_PAGE } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import type { Density } from '@/theme/tokens';
import type { GridCompaction, PageId } from '@/types';
import { BREAKPOINT_LABELS, columnsFor } from '@/utils/gridLayout';

export interface GridToolbarProps {
  page: PageId;
  onOpenMarketplace: () => void;
}

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

/**
 * Workspace toolbar. Edit layout switches between view mode (locked, no drag/resize/remove
 * controls) and edit mode, which adds Undo / Redo, an empty slot, the marketplace and
 * compaction. Density and the breakpoint label are shown in both modes.
 */
export function GridToolbar({ page, onOpenMarketplace }: GridToolbarProps) {
  const gridConfig = useDashboardStore((s) => s.gridConfig);
  const breakpoint = useDashboardStore((s) => s.activeBreakpoint);
  const locked = useDashboardStore((s) => s.locked);
  const setLocked = useDashboardStore((s) => s.setLocked);
  const density = useDashboardStore((s) => s.density);
  const setDensity = useDashboardStore((s) => s.setDensity);
  const history = useUndoRedo();
  const notify = useToast();
  const cols = columnsFor(gridConfig)[breakpoint];
  const editing = !locked;

  const toggleEdit = () => {
    setLocked(editing);
    notify({
      message: editing ? 'View mode: layout locked' : 'Edit mode: drag, resize and remove widgets',
    });
  };

  const add = () => {
    const id = addPlaceholder(page);
    if (!id) {
      notify({
        message: `This page already has the maximum of ${MAX_WIDGETS_PER_PAGE} widgets. Remove one first.`,
        tone: 'error',
      });
      return;
    }
    notify({ message: 'Empty slot added. Choose a widget for it.' });
    // Bring the new slot into view once the grid has placed it.
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-instance-id="${id}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  };

  const changeCompaction = (next: GridCompaction) => {
    if (!applyGridConfig({ compaction: next })) {
      notify({ message: 'Could not change compaction', tone: 'error' });
    }
  };

  return (
    <div role="group" aria-label="Workspace" className="flex flex-wrap items-center gap-1.5">
      <Button
        size="sm"
        variant={editing ? 'primary' : 'secondary'}
        icon={IconPencil}
        aria-pressed={editing}
        onClick={toggleEdit}
        title="Drag, resize, duplicate and remove widgets (shortcut L)"
      >
        Edit layout
      </Button>
      {editing ? (
        <>
          <IconButton
            label={history.undoLabel ? `Undo ${history.undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)'}
            icon={IconUndo}
            size="sm"
            disabled={!history.canUndo}
            onClick={history.undo}
          />
          <IconButton
            label={
              history.redoLabel ? `Redo ${history.redoLabel} (Ctrl+Shift+Z)` : 'Redo (Ctrl+Shift+Z)'
            }
            icon={IconRedo}
            size="sm"
            disabled={!history.canRedo}
            onClick={history.redo}
          />
          <Button size="sm" icon={IconPlus} onClick={add}>
            Add widget
          </Button>
          <Button size="sm" icon={IconStore} onClick={onOpenMarketplace}>
            Marketplace
          </Button>
          <Segmented<GridCompaction>
            label="Compaction"
            value={gridConfig.compaction}
            options={[
              { value: 'vertical', label: 'Packed' },
              { value: 'none', label: 'Free' },
            ]}
            onValueChange={changeCompaction}
          />
        </>
      ) : null}
      <Segmented<Density>
        label="Density"
        value={density}
        options={DENSITY_OPTIONS}
        onValueChange={(next) => {
          setDensity(next);
          notify({ message: `Density: ${next === 'compact' ? 'Compact' : 'Comfortable'}` });
        }}
      />
      <span
        className="num whitespace-nowrap text-2xs text-subtle"
        title="Each breakpoint keeps its own layout"
      >
        {BREAKPOINT_LABELS[breakpoint]} · {cols} col{cols === 1 ? '' : 's'}
      </span>
    </div>
  );
}
