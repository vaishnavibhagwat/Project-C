import { Button } from '@/components/Button';
import { GridToolbar } from '@/grid/GridToolbar';
import { IconRotate, IconSave, IconShare } from '@/components/Icons';
import { useLayoutStore } from '@/store/layoutStore';
import { useDashboardStore } from '@/store/dashboardStore';
import type { PageMeta } from '@/registry/pages';

export interface PageToolbarProps {
  page: PageMeta;
  onOpenMarketplace: () => void;
  onOpenLayouts: () => void;
  onShare: () => void;
  onReset: () => void;
}

export function PageToolbar({
  page,
  onOpenMarketplace,
  onOpenLayouts,
  onShare,
  onReset,
}: PageToolbarProps) {
  const locked = useDashboardStore((s) => s.locked);
  const activeId = useLayoutStore((s) => s.activeByPage[page.id]);
  const activeName = useLayoutStore((s) => s.savedLayouts.find((l) => l.id === activeId)?.name);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-2">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold text-fg">{page.title}</h1>
        <p className="truncate text-xs text-muted">
          {page.description}
          {activeName ? <span className="text-subtle"> · Layout: {activeName}</span> : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <GridToolbar page={page.id} onOpenMarketplace={onOpenMarketplace} />
        <span aria-hidden="true" className="mx-1 hidden h-5 border-l border-line sm:block" />
        <Button size="sm" icon={IconSave} onClick={onOpenLayouts}>
          Layouts
        </Button>
        <Button size="sm" icon={IconShare} onClick={onShare}>
          Share
        </Button>
        {locked ? null : (
          <Button size="sm" variant="ghost" icon={IconRotate} onClick={onReset}>
            Reset layout
          </Button>
        )}
      </div>
    </div>
  );
}
