import { memo, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { IconButton } from '@/components/Button';
import { IconChevronLeft, IconChevronRight } from '@/components/Icons';
import { SearchInput } from '@/components/SearchInput';
import { useToast } from '@/components/Toast';
import type { RegisteredWidget } from '@/registry/defineWidget';
import { CATEGORIES, CATEGORY_LABELS, widgetRegistry } from '@/registry/registry';
import { addWidgetToPage, MAX_WIDGETS_PER_PAGE } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import type { PageId, WidgetCategory } from '@/types';
import { cx } from '@/utils/cx';
import { CATALOGUE_DRAG_TYPE, endCatalogueDrag, startCatalogueDrag } from './catalogueDrag';

interface CatalogueGroup {
  category: WidgetCategory;
  widgets: RegisteredWidget[];
}

/** Registered widgets matching `query` (name, description or category), grouped by category. */
export function groupCatalogue(
  widgets: readonly RegisteredWidget[],
  query: string,
): CatalogueGroup[] {
  const q = query.trim().toLowerCase();
  const matches = (w: RegisteredWidget) =>
    q === '' ||
    w.name.toLowerCase().includes(q) ||
    w.description.toLowerCase().includes(q) ||
    CATEGORY_LABELS[w.category].toLowerCase().includes(q);
  return CATEGORIES.map((category) => ({
    category,
    widgets: widgets.filter((w) => w.category === category && matches(w)),
  })).filter((group) => group.widgets.length > 0);
}

/** Longest wait for an idle moment before prefetching anyway. */
const PREFETCH_TIMEOUT_MS = 2000;

/**
 * Load every widget's code chunk ahead of use, once the browser is idle so the page's own
 * widgets load first. Safe to repeat (imports are cached). Returns a cancel function.
 */
export function prefetchWidgetChunks(): () => void {
  const run = () => {
    for (const widget of widgetRegistry.getAllWidgets()) widget.preload();
  };
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run, { timeout: PREFETCH_TIMEOUT_MS });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = window.setTimeout(run, 200);
  return () => window.clearTimeout(timer);
}

const CatalogueItem = memo(function CatalogueItem({
  widget,
  disabled,
  onAdd,
}: {
  widget: RegisteredWidget;
  disabled: boolean;
  onAdd: (widget: RegisteredWidget) => void;
}) {
  const Icon = widget.icon;
  const descriptionId = useId();
  return (
    <li>
      <button
        type="button"
        data-testid={`catalogue-item-${widget.id}`}
        aria-label={`Add ${widget.name}`}
        aria-describedby={descriptionId}
        disabled={disabled}
        draggable={!disabled}
        title={disabled ? undefined : 'Click to add, or drag onto the grid'}
        onClick={() => onAdd(widget)}
        onDragStart={(e) => {
          e.dataTransfer.setData(CATALOGUE_DRAG_TYPE, widget.id);
          // Some browsers only start a drag with a text payload.
          e.dataTransfer.setData('text/plain', widget.name);
          e.dataTransfer.effectAllowed = 'copy';
          startCatalogueDrag(widget.id);
        }}
        onDragEnd={endCatalogueDrag}
        className={cx(
          'flex w-full items-start gap-2 rounded border border-line bg-panel p-2 text-left',
          'hover:border-accent/60 hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing',
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-raised text-accent">
          <Icon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-fg">{widget.name}</span>
          <span id={descriptionId} className="line-clamp-2 text-2xs leading-snug text-muted">
            {widget.description}
          </span>
        </span>
      </button>
    </li>
  );
});

export interface WidgetCatalogueProps {
  page: PageId;
}

/**
 * Collapsible sidebar listing every registered widget by category. Click a widget to add it
 * to the bottom of the page, or drag it onto the grid to place it. Opening the catalogue
 * prefetches every widget chunk (when the browser is idle) so added widgets render without a loading pause. Adding stops
 * at VITE_MAX_WIDGETS widgets per page. Shown in edit mode only.
 */
function WidgetCatalogueImpl({ page }: WidgetCatalogueProps) {
  const open = useDashboardStore((s) => s.catalogueOpen);
  const setOpen = useDashboardStore((s) => s.setCatalogueOpen);
  const count = useDashboardStore((s) => s.pages[page].itemIds.length);
  const full = count >= MAX_WIDGETS_PER_PAGE;
  const [query, setQuery] = useState('');
  const notify = useToast();
  const panelId = useId();
  const headingId = useId();

  useEffect(() => (open ? prefetchWidgetChunks() : undefined), [open]);

  const groups = useMemo(() => groupCatalogue(widgetRegistry.getAllWidgets(), query), [query]);
  const found = groups.reduce((n, g) => n + g.widgets.length, 0);

  const add = useCallback(
    (widget: RegisteredWidget) => {
      const id = addWidgetToPage(page, widget.id);
      if (!id) {
        notify({
          message: `This page already has the maximum of ${MAX_WIDGETS_PER_PAGE} widgets. Remove one first.`,
          tone: 'error',
        });
        return;
      }
      notify({ message: `Added ${widget.name}`, tone: 'success' });
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-instance-id="${id}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      );
    },
    [page, notify],
  );

  if (!open) {
    return (
      <aside
        aria-label="Widget catalogue"
        className="sticky top-0 hidden shrink-0 self-start md:block"
      >
        <IconButton
          label="Show widget catalogue"
          icon={IconChevronLeft}
          size="sm"
          tooltipSide="left"
          aria-expanded={false}
          onClick={() => setOpen(true)}
        />
      </aside>
    );
  }

  return (
    <aside
      id={panelId}
      aria-labelledby={headingId}
      className="sticky top-0 hidden max-h-[calc(100vh-6rem)] w-64 shrink-0 flex-col gap-2 self-start rounded border border-line bg-bg p-2 md:flex"
    >
      <div className="flex items-center gap-2">
        <h2 id={headingId} className="flex-1 text-sm font-semibold text-fg">
          Widget catalogue
        </h2>
        <span
          className={cx('num text-2xs', full ? 'text-warn' : 'text-subtle')}
          title="Widgets on this page (VITE_MAX_WIDGETS)"
        >
          {count} / {MAX_WIDGETS_PER_PAGE}
        </span>
        <IconButton
          label="Hide widget catalogue"
          icon={IconChevronRight}
          size="sm"
          aria-expanded
          aria-controls={panelId}
          onClick={() => setOpen(false)}
        />
      </div>
      <SearchInput label="Search widgets" placeholder="Search widgets" onSearch={setQuery} />
      {full ? (
        <p role="status" className="rounded bg-warn/10 px-2 py-1 text-2xs text-warn">
          Page full: {MAX_WIDGETS_PER_PAGE} widgets is the limit. Remove one to add more.
        </p>
      ) : (
        <p className="text-2xs text-subtle">Click to add, or drag onto the grid.</p>
      )}
      <p aria-live="polite" className="sr-only">
        {query === '' ? '' : `${found} widget${found === 1 ? '' : 's'} found`}
      </p>
      <div className="scroll-thin -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div
            role="group"
            key={group.category}
            aria-labelledby={`${headingId}-${group.category}`}
            className="mb-3"
          >
            <h3
              id={`${headingId}-${group.category}`}
              className="mb-1 flex items-center justify-between text-2xs font-semibold uppercase tracking-wide text-subtle"
            >
              {CATEGORY_LABELS[group.category]}
              <span className="num font-normal">{group.widgets.length}</span>
            </h3>
            <ul className="flex flex-col gap-1">
              {group.widgets.map((widget) => (
                <CatalogueItem key={widget.id} widget={widget} disabled={full} onAdd={add} />
              ))}
            </ul>
          </div>
        ))}
        {groups.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">No widgets match “{query}”.</p>
        ) : null}
      </div>
    </aside>
  );
}

export const WidgetCatalogue = memo(WidgetCatalogueImpl);
