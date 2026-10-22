import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Delta';
import { SelectField } from '@/components/FormControls';
import { IconPlus, IconSearch } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { PAGES } from '@/registry/pages';
import { CATEGORIES, CATEGORY_LABELS, widgetRegistry } from '@/registry/registry';
import { addWidget, MAX_WIDGETS_PER_PAGE } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { PageIdSchema } from '@/store/schemas';
import type { PageId, WidgetCategory } from '@/types';
import { cx } from '@/utils/cx';

/** Browse every registered widget and add it to any page. */
export function WidgetMarketplace({
  initialTarget,
  onOpenPage,
}: {
  initialTarget: PageId;
  onOpenPage: (page: PageId) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<WidgetCategory | 'ALL'>('ALL');
  const [target, setTarget] = useState<PageId>(initialTarget);
  const notify = useToast();

  const widgets = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool =
      category === 'ALL'
        ? widgetRegistry.getAllWidgets()
        : widgetRegistry.getWidgetsByCategory(category);
    return pool.filter(
      (w) =>
        q === '' || w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q),
    );
  }, [query, category]);

  const targetMeta = PAGES.find((p) => p.id === target);
  const targetCount = useDashboardStore((s) => s.pages[target].itemIds.length);
  const targetFull = targetCount >= MAX_WIDGETS_PER_PAGE;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-lg font-semibold text-fg">Widget Marketplace</h1>
        <p className="text-xs text-muted">
          {widgetRegistry.size} widgets. Every widget loads on demand as its own code chunk.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="relative w-64">
          <span className="sr-only">Search widgets</span>
          <IconSearch size={14} className="pointer-events-none absolute left-2 top-2 text-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search widgets"
            className="h-8 w-full rounded border border-line-strong bg-bg pl-7 pr-2 text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1">
          {(['ALL', ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cx(
                'h-7 rounded border px-2 text-xs',
                category === c
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-muted hover:text-fg',
              )}
            >
              {c === 'ALL' ? 'All' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="ml-auto w-56">
          <SelectField
            label="Add widgets to"
            description={`${targetCount} of ${MAX_WIDGETS_PER_PAGE} widgets used${targetFull ? ' · page full' : ''}`}
            value={target}
            options={PAGES.map((p) => ({ value: p.id, label: p.title }))}
            onValueChange={(v) => {
              const parsed = PageIdSchema.safeParse(v);
              if (parsed.success) setTarget(parsed.data);
            }}
          />
        </div>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
        {widgets.map((w) => {
          const Icon = w.icon;
          return (
            <li
              key={w.id}
              className="flex flex-col gap-2 rounded border border-line bg-panel p-3"
              onMouseEnter={w.preload}
              onFocus={w.preload}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-raised text-accent">
                  <Icon />
                </span>
                <h2 className="flex-1 text-sm font-semibold text-fg">{w.name}</h2>
                <Badge>{CATEGORY_LABELS[w.category]}</Badge>
              </div>
              <p className="flex-1 text-xs leading-snug text-muted">{w.description}</p>
              <dl className="num grid grid-cols-2 gap-x-2 text-2xs text-subtle">
                <dt>Default size</dt>
                <dd className="text-right">
                  {w.defaultSize.w}×{w.defaultSize.h}
                </dd>
                <dt>Refresh</dt>
                <dd className="text-right">{Math.round(w.dataSource.refreshInterval / 1000)}s</dd>
              </dl>
              <Button
                size="sm"
                icon={IconPlus}
                disabled={targetFull}
                title={targetFull ? `${targetMeta?.short ?? target} is full` : undefined}
                onClick={() => {
                  if (addWidget(target, w.id)) {
                    notify({
                      message: `Added ${w.name} to ${targetMeta?.short ?? target}`,
                      tone: 'success',
                      action: { label: 'View', onClick: () => onOpenPage(target) },
                    });
                  }
                }}
              >
                Add to {targetMeta?.short ?? target}
              </Button>
            </li>
          );
        })}
      </ul>
      {widgets.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No widgets match.</p>
      ) : null}
    </div>
  );
}
