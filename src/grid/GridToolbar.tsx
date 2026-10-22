import { Button } from '@/components/Button';
import { Segmented } from '@/components/FormControls';
import { IconPlus, IconStore } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { addPlaceholder, applyGridConfig, MAX_WIDGETS_PER_PAGE } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import type { GridCompaction, PageId } from '@/types';
import { BREAKPOINT_LABELS, columnsFor } from '@/utils/gridLayout';

export interface GridToolbarProps {
  page: PageId;
  onOpenMarketplace: () => void;
}

/**
 * Grid controls: add an empty slot at the next free position, open the marketplace, switch
 * compaction, and show which breakpoint layout is on screen.
 */
export function GridToolbar({ page, onOpenMarketplace }: GridToolbarProps) {
  const gridConfig = useDashboardStore((s) => s.gridConfig);
  const breakpoint = useDashboardStore((s) => s.activeBreakpoint);
  const notify = useToast();
  const cols = columnsFor(gridConfig)[breakpoint];

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

  return (
    <div role="group" aria-label="Grid controls" className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" variant="primary" icon={IconPlus} onClick={add}>
        Add widget
      </Button>
      <Button size="sm" icon={IconStore} onClick={onOpenMarketplace}>
        Marketplace
      </Button>
      <Segmented<GridCompaction>
        label="Compaction"
        value={gridConfig.compaction}
        options={[
          { value: 'vertical', label: 'Compact' },
          { value: 'none', label: 'Free' },
        ]}
        onValueChange={(next) => applyGridConfig({ compaction: next })}
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
