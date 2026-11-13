import { useMemo, useState, useTransition } from 'react';
import { Button, IconButton } from '@/components/Button';
import { Segmented } from '@/components/FormControls';
import { IconCopy, IconDownload, IconHistory, IconTrash } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { usePersistStatus } from '@/hooks/usePersistStatus';
import { getPageMeta, type PageMeta } from '@/registry/pages';
import { isPlaceholder } from '@/registry/placeholder';
import { describeApplyResult } from '@/store/actions';
import { MAX_VERSIONS, useLayoutStore } from '@/store/layoutStore';
import type { PersistStatus } from '@/store/persistStatus';
import type { Layout } from '@/types';
import { cx } from '@/utils/cx';
import { formatIstDateTime, formatIstTime, toIstIso } from '@/utils/time';
import { exportSavedLayout, loadSavedLayout } from './layoutFile';
import { LayoutThumbnail } from './LayoutThumbnail';

export type LayoutBrowserView = 'list' | 'grid';
type Scope = 'page' | 'all';

const VIEW_OPTIONS: { value: LayoutBrowserView; label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
];
const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: 'page', label: 'This page' },
  { value: 'all', label: 'All pages' },
];

/** Widgets in a layout's current version (empty slots are not counted). */
export function widgetCount(layout: Layout): number {
  const latest = layout.versions[layout.versions.length - 1];
  return latest ? latest.snapshot.instances.filter((i) => !isPlaceholder(i.widgetId)).length : 0;
}

/** "Saved in this browser at 19:02:11 IST", "Saving…" or the storage error. */
export function persistMessage(status: PersistStatus): string {
  if (status.state === 'error') {
    return status.quotaExceeded
      ? 'Browser storage is full: layouts are kept in memory for this session.'
      : 'Could not write to browser storage: layouts are kept in memory for this session.';
  }
  if (status.state === 'pending') return 'Saving…';
  return status.savedAt === null
    ? 'Layouts are saved in this browser automatically.'
    : `Saved in this browser at ${formatIstTime(status.savedAt)}.`;
}

interface CardProps {
  layout: Layout;
  view: LayoutBrowserView;
  active: boolean;
  showPage: boolean;
  loading: boolean;
  onLoad: (layout: Layout, version?: number) => void;
  onRevert: (layout: Layout, version: number) => void;
}

function LayoutCard({ layout, view, active, showPage, loading, onLoad, onRevert }: CardProps) {
  const notify = useToast();
  const [showVersions, setShowVersions] = useState(false);
  const latest = layout.versions[layout.versions.length - 1];
  const count = widgetCount(layout);
  const grid = view === 'grid';

  return (
    <li
      className={cx(
        'flex rounded border p-2',
        grid ? 'flex-col gap-2' : 'flex-col',
        active ? 'border-accent/60 bg-accent/5' : 'border-line',
      )}
      aria-label={layout.name}
    >
      <div className={cx('flex gap-2', grid ? 'flex-col' : 'items-start')}>
        {latest ? (
          <LayoutThumbnail
            snapshot={latest.snapshot}
            className={cx(
              'shrink-0 rounded border border-line',
              grid ? 'aspect-[4/3] w-full' : 'h-14 w-20',
            )}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
            <span className="truncate">{layout.name}</span>
            {active ? (
              <span className="shrink-0 rounded bg-accent/15 px-1 text-2xs font-semibold text-accent">
                Loaded
              </span>
            ) : null}
          </p>
          {layout.description ? (
            <p className="line-clamp-2 text-2xs text-muted" title={layout.description}>
              {layout.description}
            </p>
          ) : null}
          <p className="num text-2xs text-subtle">
            Created {formatIstDateTime(Date.parse(layout.createdAt))} · {count} widget
            {count === 1 ? '' : 's'} · v{latest?.version ?? 1}
            {showPage ? ` · ${getPageMeta(layout.page).short}` : ''}
          </p>
        </div>
      </div>
      <div className={cx('mt-1.5 flex items-center gap-1', grid && 'mt-0')}>
        <Button
          size="sm"
          variant={active ? 'secondary' : 'primary'}
          loading={loading}
          onClick={() => onLoad(layout)}
          aria-label={`Load ${layout.name}`}
        >
          Load
        </Button>
        <span className="flex-1" />
        <IconButton
          label={`Versions of ${layout.name}`}
          icon={IconHistory}
          active={showVersions}
          aria-expanded={showVersions}
          onClick={() => setShowVersions((v) => !v)}
        />
        <IconButton
          label={`Save ${layout.name} as a new copy`}
          icon={IconCopy}
          onClick={() => {
            const id = useLayoutStore.getState().duplicateLayout(layout.id, toIstIso(Date.now()));
            if (id) notify({ message: `Copied “${layout.name}”`, tone: 'success' });
          }}
        />
        <IconButton
          label={`Export ${layout.name}`}
          icon={IconDownload}
          onClick={() => exportSavedLayout(layout)}
        />
        <IconButton
          label={`Delete ${layout.name}`}
          icon={IconTrash}
          onClick={() => {
            useLayoutStore.getState().deleteLayout(layout.id);
            notify({ message: `Deleted “${layout.name}”` });
          }}
        />
      </div>
      {showVersions ? (
        <ol
          className="mt-2 flex flex-col gap-1 border-t border-line pt-2"
          aria-label={`Versions of ${layout.name} (last ${MAX_VERSIONS} kept)`}
        >
          {[...layout.versions].reverse().map((v) => {
            const current = v.version === latest?.version;
            return (
              <li key={v.version} className="flex items-center gap-2 text-xs">
                <span className="num w-8 shrink-0 text-fg">v{v.version}</span>
                <span className="num min-w-0 flex-1 truncate text-muted">
                  {formatIstDateTime(Date.parse(v.createdAt))} · {v.note}
                </span>
                {current ? (
                  <span className="text-2xs text-subtle">Current</span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Revert ${layout.name} to v${v.version}`}
                    onClick={() => onRevert(layout, v.version)}
                  >
                    Revert
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
    </li>
  );
}

/**
 * Saved layouts as a list or a grid: name, created date, widget count and a thumbnail of the
 * widget positions. Load goes through the layout-file pipeline (serialise, parse, validate,
 * instantiate, position) inside a transition. Each layout keeps its last 10 versions, each
 * with Revert.
 */
export function LayoutBrowser({
  page,
  defaultView = 'list',
}: {
  page: PageMeta;
  defaultView?: LayoutBrowserView;
}) {
  const saved = useLayoutStore((s) => s.savedLayouts);
  const activeId = useLayoutStore((s) => s.activeByPage[page.id]);
  const status = usePersistStatus('meridian:layouts');
  const notify = useToast();
  const [view, setView] = useState<LayoutBrowserView>(defaultView);
  const [scope, setScope] = useState<Scope>('page');
  const [isPending, startLoading] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const shown = useMemo(
    () =>
      saved
        .filter((l) => scope === 'all' || l.page === page.id)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [saved, scope, page.id],
  );

  const load = (layout: Layout, version?: number, prefix = 'Loaded') => {
    setLoadingId(layout.id);
    startLoading(() => {
      const outcome = loadSavedLayout(layout, page.id, version);
      if (!outcome.ok) {
        notify({
          message: `Could not load “${layout.name}”: ${outcome.issues[0] ?? outcome.error}`,
          tone: 'error',
        });
        return;
      }
      notify({
        message: `${prefix} “${layout.name}” v${outcome.version}${describeApplyResult(outcome.result)}`,
        tone: 'success',
      });
    });
  };

  const revert = (layout: Layout, version: number) => {
    const next = useLayoutStore
      .getState()
      .revertToVersion(layout.id, version, toIstIso(Date.now()));
    const updated = useLayoutStore.getState().savedLayouts.find((l) => l.id === layout.id);
    if (next === null || !updated) return;
    load(updated, next, `Reverted to v${version}:`);
  };

  return (
    <section aria-labelledby="saved-layouts-heading" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="saved-layouts-heading"
          className="text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Saved layouts ({shown.length})
        </h3>
        <div className="flex items-center gap-1.5">
          <Segmented<Scope>
            label="Show layouts for"
            hideLabel
            size="xs"
            value={scope}
            options={SCOPE_OPTIONS}
            onValueChange={setScope}
          />
          <Segmented<LayoutBrowserView>
            label="View as"
            hideLabel
            size="xs"
            value={view}
            options={VIEW_OPTIONS}
            onValueChange={setView}
          />
        </div>
      </div>
      <p
        role="status"
        className={cx('text-2xs', status.state === 'error' ? 'text-neg' : 'text-subtle')}
      >
        {persistMessage(status)}
      </p>
      {shown.length === 0 ? (
        <p className="text-xs text-muted">
          {scope === 'page'
            ? 'No saved layouts for this page yet. Use Save to keep the current one.'
            : 'No saved layouts yet.'}
        </p>
      ) : (
        <ul
          aria-label={`Saved layouts, ${view} view`}
          className={cx(view === 'grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2')}
        >
          {shown.map((layout) => (
            <LayoutCard
              key={layout.id}
              layout={layout}
              view={view}
              active={layout.id === activeId}
              showPage={scope === 'all'}
              loading={isPending && loadingId === layout.id}
              onLoad={load}
              onRevert={revert}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
