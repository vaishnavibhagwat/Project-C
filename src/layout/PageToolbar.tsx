import { Button } from '@/components/Button';
import {
  IconLock,
  IconPlus,
  IconRotate,
  IconSave,
  IconShare,
  IconUnlock,
} from '@/components/Icons';
import { useLayoutStore } from '@/store/layoutStore';
import { useDashboardStore } from '@/store/dashboardStore';
import type { PageMeta } from '@/registry/pages';

export interface PageToolbarProps {
  page: PageMeta;
  onAddWidget: () => void;
  onOpenLayouts: () => void;
  onShare: () => void;
  onReset: () => void;
}

export function PageToolbar({
  page,
  onAddWidget,
  onOpenLayouts,
  onShare,
  onReset,
}: PageToolbarProps) {
  const locked = useDashboardStore((s) => s.locked);
  const setLocked = useDashboardStore((s) => s.setLocked);
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
        <Button size="sm" variant="primary" icon={IconPlus} onClick={onAddWidget}>
          Add widget
        </Button>
        <Button size="sm" icon={IconSave} onClick={onOpenLayouts}>
          Layouts
        </Button>
        <Button size="sm" icon={IconShare} onClick={onShare}>
          Share
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={locked ? IconLock : IconUnlock}
          aria-pressed={locked}
          onClick={() => setLocked(!locked)}
          title="Lock prevents dragging and resizing (shortcut L)"
        >
          {locked ? 'Locked' : 'Unlocked'}
        </Button>
        <Button size="sm" variant="ghost" icon={IconRotate} onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
