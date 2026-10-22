import { useShallow } from 'zustand/react/shallow';
import { Dropdown, type DropdownItem } from '@/components/Dropdown';
import { IconChevronDown, IconSave } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { useAppRoute } from '@/hooks/useAppRoute';
import { getPageMeta, PAGES } from '@/registry/pages';
import { applySnapshot } from '@/store/actions';
import { useLayoutStore } from '@/store/layoutStore';
import type { Layout, PageId } from '@/types';
import { formatIstDateTime } from '@/utils/time';

export interface WorkspaceSelectorProps {
  /** The dashboard being shown, or the last one visited (on Marketplace and Settings). */
  page: PageId;
  onManageLayouts: () => void;
}

/** Dashboard and workspace switcher: the five dashboards, then this dashboard's saved layouts. */
export function WorkspaceSelector({ page, onManageLayouts }: WorkspaceSelectorProps) {
  const { route, navigate } = useAppRoute();
  const saved = useLayoutStore(useShallow((s) => s.savedLayouts.filter((l) => l.page === page)));
  const activeId = useLayoutStore((s) => s.activeByPage[page]);
  const setActive = useLayoutStore((s) => s.setActive);
  const notify = useToast();
  const meta = getPageMeta(page);
  const active = saved.find((l) => l.id === activeId);
  const onDashboard = route === page;

  const load = (layout: Layout) => {
    const latest = layout.versions[layout.versions.length - 1];
    if (!latest) return;
    const result = applySnapshot(page, latest.snapshot);
    setActive(page, layout.id);
    if (!onDashboard) navigate(page);
    notify({
      message: `Loaded “${layout.name}” v${latest.version}${result.dropped > 0 ? ` (${result.dropped} left out)` : ''}`,
      tone: 'success',
    });
  };

  const layoutItems: DropdownItem[] =
    saved.length === 0
      ? [{ id: 'none', label: 'No saved layouts yet', disabled: true, onSelect: () => undefined }]
      : saved.map((layout) => ({
          id: layout.id,
          label: layout.name,
          description: `v${layout.versions[layout.versions.length - 1]?.version ?? 1} · ${formatIstDateTime(Date.parse(layout.updatedAt))}`,
          checked: layout.id === activeId,
          onSelect: () => load(layout),
        }));

  const items: DropdownItem[] = [
    { type: 'label', id: 'dashboards', label: 'Dashboards' },
    ...PAGES.map((p) => ({
      id: `page-${p.id}`,
      label: p.title,
      checked: onDashboard && p.id === page,
      onSelect: () => navigate(p.id),
    })),
    { type: 'separator', id: 'separator-layouts' },
    { type: 'label', id: 'layouts', label: `Saved layouts · ${meta.short}` },
    ...layoutItems,
    { type: 'separator', id: 'separator-manage' },
    { id: 'manage', label: 'Manage layouts…', icon: IconSave, onSelect: onManageLayouts },
  ];

  return (
    <Dropdown
      width="w-72"
      items={items}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`Dashboard: ${meta.title}${active ? `, layout ${active.name}` : ''}`}
          className="flex h-7 min-w-0 items-center gap-1.5 rounded border border-line bg-bg px-2 text-xs text-fg hover:border-line-strong"
        >
          <span className="truncate font-medium">{meta.short}</span>
          {active ? (
            <span className="hidden truncate text-muted lg:inline">· {active.name}</span>
          ) : null}
          <IconChevronDown size={12} className="shrink-0 text-subtle" />
        </button>
      )}
    />
  );
}
