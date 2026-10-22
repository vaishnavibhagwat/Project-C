import { memo } from 'react';
import { Button, IconButton } from '@/components/Button';
import { Dropdown, type DropdownItem } from '@/components/Dropdown';
import { IconChevronDown, IconClose, IconDrag, IconPlus } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { CATEGORIES, CATEGORY_LABELS, widgetRegistry } from '@/registry/registry';
import { fillPlaceholder, removeWidgetFromPage, restoreRemovedWidget } from '@/store/actions';
import type { PageId } from '@/types';
import { cx } from '@/utils/cx';
import { DRAG_HANDLE_CLASS, NO_DRAG_CLASS } from './WidgetFrame';

/** Every registered widget, grouped by category, as menu items for filling a slot. */
function widgetMenu(onPick: (widgetId: string, name: string) => void): DropdownItem[] {
  return CATEGORIES.flatMap((category) => {
    const widgets = widgetRegistry.getWidgetsByCategory(category);
    if (widgets.length === 0) return [];
    return [
      { type: 'label' as const, id: `label-${category}`, label: CATEGORY_LABELS[category] },
      ...widgets.map((w) => ({
        id: w.id,
        label: w.name,
        icon: w.icon,
        onSelect: () => onPick(w.id, w.name),
      })),
    ];
  });
}

/**
 * An empty slot added by the grid toolbar. It can be moved and resized like a widget; choosing
 * a widget turns it into that widget in place.
 */
export const PlaceholderCard = memo(function PlaceholderCard({
  page,
  instanceId,
}: {
  page: PageId;
  instanceId: string;
}) {
  const notify = useToast();
  const items = widgetMenu((widgetId, name) => {
    if (fillPlaceholder(page, instanceId, widgetId)) {
      notify({ message: `Added ${name}`, tone: 'success' });
    }
  });

  const remove = () => {
    const removed = removeWidgetFromPage(page, instanceId);
    if (removed) {
      notify({
        message: 'Removed empty slot',
        action: { label: 'Undo', onClick: () => restoreRemovedWidget(removed) },
      });
    }
  };

  return (
    <section
      role="region"
      aria-label="Empty widget slot"
      data-testid={`placeholder-${instanceId}`}
      className="flex h-full flex-col overflow-hidden rounded border border-dashed border-line-strong bg-panel/60"
    >
      <header className="flex h-8 shrink-0 items-center gap-1 border-b border-dashed border-line pl-1 pr-1">
        <div
          className={cx(
            DRAG_HANDLE_CLASS,
            'flex min-w-0 flex-1 cursor-grab items-center gap-1 active:cursor-grabbing',
          )}
        >
          <IconDrag size={14} className="shrink-0 text-subtle" />
          <h2 className="truncate text-xs font-semibold text-muted">Empty slot</h2>
        </div>
        <IconButton
          label="Remove empty slot"
          icon={IconClose}
          size="xs"
          className={NO_DRAG_CLASS}
          onClick={remove}
        />
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-3 text-center">
        <p className="text-xs text-muted">Choose a widget for this space.</p>
        <div className={NO_DRAG_CLASS}>
          <Dropdown
            width="w-64"
            items={items}
            trigger={(props) => (
              <Button {...props} size="sm" variant="primary" icon={IconPlus}>
                Choose widget
                <IconChevronDown size={12} />
              </Button>
            )}
          />
        </div>
      </div>
    </section>
  );
});
