import {
  memo,
  Profiler,
  Suspense,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, IconButton } from '@/components/Button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IconAlert, IconCopy, IconRefresh, IconWifiOff } from '@/components/Icons';
import { Modal } from '@/components/Overlay';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { useToast } from '@/components/Toast';
import { InfoTooltip } from '@/components/Tooltip';
import {
  DRAG_HANDLE_CLASS,
  NO_DRAG_CLASS,
  WidgetShell,
  type WidgetShellStatus,
} from '@/components/WidgetShell';
import { WidgetSkeleton } from '@/components/WidgetSkeleton';
import { endpointUrl } from '@/data/api';
import { setSimulatedOutage } from '@/data/connection';
import { useConnection } from '@/hooks/useConnection';
import { useElementSize } from '@/hooks/useElementSize';
import { useDataSource } from '@/hooks/useEndpoint';
import { useNow } from '@/hooks/useNow';
import { useThrottledValue } from '@/hooks/useThrottledValue';
import type { RegisteredWidget } from '@/registry/defineWidget';
import { widgetRegistry } from '@/registry/registry';
import {
  duplicateWidget,
  MAX_WIDGETS_PER_PAGE,
  removeWidgetFromPage,
  restoreRemovedWidget,
  setWidgetCollapsed,
} from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import type { PageId, WidgetConfig, WidgetInstance } from '@/types';
import { recordWidgetRender } from '@/utils/perf';
import { formatIstTime, toIstIso } from '@/utils/time';

// The grid's drag handle classes live with the shell that renders them.
export { DRAG_HANDLE_CLASS, NO_DRAG_CLASS };

/** Below this width (px) the header drops its plain timestamp so the title is not cut off. */
const COMPACT_HEADER_PX = 380;

/** Data older than this multiple of the refresh interval is flagged as stale. */
export const STALE_MULTIPLIER = 2;

export function isStale(updatedAt: number, refreshIntervalMs: number, now: number): boolean {
  return updatedAt > 0 && now - updatedAt > refreshIntervalMs * STALE_MULTIPLIER;
}

function errorMessage(error: Error | null): string {
  if (!error) return 'Unknown error.';
  if (error.name === 'ValidationError')
    return `${error.message}. The response was rejected and not displayed.`;
  return error.message;
}

interface FrameBodyProps {
  page: PageId;
  instance: WidgetInstance;
  entry: RegisteredWidget;
}

function FrameBody({ page, instance, entry }: FrameBodyProps) {
  const Widget = entry.component;
  const refresh = entry.dataSource.refreshInterval;
  const title = instance.title ?? entry.name;
  const query = useDataSource(entry.dataSource);
  const connection = useConnection();
  const now = useNow(5000);
  const [bodyRef, size] = useElementSize<HTMLDivElement>();
  const openSettings = useWidgetStore((s) => s.openSettings);
  // View mode (locked) hides the layout controls: drag handle, settings, duplicate, collapse,
  // remove.
  const editing = !useDashboardStore((s) => s.locked);
  const updateConfig = useWidgetStore((s) => s.updateConfig);
  const notify = useToast();

  const { dataUpdatedAt, isPending, isError, error, isFetching, refetch } = query;
  // Re-render widget bodies for new data at transition priority, so React can split the work
  // across frames (and between widgets) instead of one long blocking task.
  const data = useDeferredValue(query.data);
  const stale = data !== undefined && isStale(dataUpdatedAt, refresh, now);
  const disconnected = !connection.connected;
  const config = useMemo(() => entry.resolveConfig(instance.config), [entry, instance.config]);
  const summary = useMemo(
    () => (data === undefined ? '' : entry.summarize(data, instance.config)),
    [data, entry, instance.config],
  );
  const badgeCount = useMemo(
    () => (data === undefined ? null : entry.badge(data, instance.config)),
    [data, entry, instance.config],
  );
  const liveSummary = useThrottledValue(summary, 15_000);
  const updated = dataUpdatedAt > 0 ? formatIstTime(dataUpdatedAt) : null;
  const lastUpdated = dataUpdatedAt > 0 ? toIstIso(dataUpdatedAt) : null;
  const { instanceId } = instance;
  const collapsed = instance.collapsed !== undefined;

  const onConfigChange = useCallback(
    (patch: Partial<WidgetConfig>) => updateConfig(instanceId, patch),
    [instanceId, updateConfig],
  );

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onToggleCollapse = useCallback(() => {
    setWidgetCollapsed(page, instanceId, !collapsed);
  }, [page, instanceId, collapsed]);

  // The header's X asks first; the widget is removed only on confirm (Undo stays in the toast).
  const [confirmRemove, setConfirmRemove] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onRemove = useCallback(() => {
    setConfirmRemove(false);
    const removed = removeWidgetFromPage(page, instanceId);
    if (removed) {
      notify({
        message: `Removed “${title}”`,
        action: { label: 'Undo', onClick: () => restoreRemovedWidget(removed) },
      });
    }
  }, [instanceId, title, notify, page]);

  const onDuplicate = useCallback(() => {
    if (duplicateWidget(page, instanceId)) {
      notify({ message: `Duplicated “${title}”`, tone: 'success' });
    } else {
      notify({
        message: `This page already has the maximum of ${MAX_WIDGETS_PER_PAGE} widgets. Remove one first.`,
        tone: 'error',
      });
    }
  }, [instanceId, title, notify, page]);

  // The deferred value can trail the query by one render, so "no data yet" stays loading.
  let status: WidgetShellStatus;
  if (disconnected && data === undefined) status = 'disconnected';
  else if (isPending || (data === undefined && !isError)) status = 'loading';
  else if (data === undefined) status = 'error';
  else status = entry.isEmpty(data) ? 'empty' : 'ready';

  return (
    <>
      <WidgetShell
        title={title}
        status={status}
        skeleton={<WidgetSkeleton variant={entry.skeleton} />}
        errorMessage={errorMessage(error)}
        onRetry={onRefresh}
        retrying={isFetching}
        emptyMessage="The data source returned no rows for this widget."
        disconnectedSince={formatIstTime(connection.changedAt, false)}
        onReconnect={() => {
          setSimulatedOutage(false);
          onRefresh();
        }}
        badgeCount={badgeCount}
        lastUpdated={updated}
        stale={stale}
        staleReason={`Data is older than ${STALE_MULTIPLIER}× the ${Math.round(refresh / 1000)}s refresh interval`}
        summary={liveSummary}
        compactHeader={size.width > 0 && size.width < COMPACT_HEADER_PX}
        draggable={editing}
        collapsed={collapsed}
        onToggleCollapse={editing ? onToggleCollapse : undefined}
        onSettings={editing ? () => openSettings(instanceId) : undefined}
        onRemove={editing ? () => setConfirmRemove(true) : undefined}
        actions={
          <>
            <InfoTooltip
              label={`About ${title}`}
              content={
                <>
                  <span className="block font-medium">{entry.name}</span>
                  <span className="block text-muted">{entry.description}</span>
                  <span className="mt-1 block text-2xs text-subtle">
                    Source GET {endpointUrl(entry.dataSource.endpoint)} · refresh every{' '}
                    {Math.round(refresh / 1000)}s · simulated data
                  </span>
                  {updated ? (
                    <span className="block text-2xs text-subtle">Last updated {updated}</span>
                  ) : null}
                </>
              }
            />
            <IconButton
              label="Refresh"
              icon={IconRefresh}
              size="xs"
              onClick={onRefresh}
              disabled={disconnected}
            />
            {editing ? (
              <IconButton
                label={`Duplicate ${title}`}
                icon={IconCopy}
                size="xs"
                onClick={onDuplicate}
              />
            ) : null}
          </>
        }
        notice={
          data !== undefined && disconnected ? (
            <p
              role="status"
              className="flex shrink-0 items-center gap-1.5 border-b border-warn/30 bg-warn/10 px-3 py-1 text-2xs text-warn"
            >
              <IconWifiOff size={12} /> Disconnected · showing data from {updated ?? 'earlier'}
            </p>
          ) : data !== undefined && isError ? (
            <p
              role="alert"
              className="flex shrink-0 items-center gap-1.5 border-b border-neg/30 bg-neg/10 px-3 py-1 text-2xs text-neg"
            >
              <IconAlert size={12} /> Refresh failed · showing last good data
              <button type="button" onClick={onRefresh} className="ml-auto font-semibold underline">
                Retry
              </button>
            </p>
          ) : null
        }
        dimmed={disconnected && data !== undefined}
        busy={isFetching}
        bodyRef={bodyRef}
        testId={`widget-${instanceId}`}
      >
        <ErrorBoundary
          resetKeys={[data, instance.config]}
          fallback={(err, reset) => (
            <ErrorState
              message={`This widget failed to render: ${err.message}`}
              onRetry={() => {
                reset();
                onRefresh();
              }}
            />
          )}
        >
          <Suspense fallback={<WidgetSkeleton variant={entry.skeleton} />}>
            {/* Widgets render once the body has been measured: charts need a size. */}
            {size.width > 0 && data !== undefined ? (
              <Profiler id={instanceId} onRender={recordWidgetRender}>
                <Widget
                  instanceId={instanceId}
                  config={config}
                  data={data}
                  isLoading={isFetching}
                  error={isError ? error : null}
                  isStale={stale}
                  lastUpdated={lastUpdated}
                  onConfigChange={onConfigChange}
                  width={size.width}
                  height={size.height}
                />
              </Profiler>
            ) : null}
          </Suspense>
        </ErrorBoundary>
      </WidgetShell>
      <Modal
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`Remove ${title}?`}
        size="sm"
        role="alertdialog"
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button ref={cancelRef} onClick={() => setConfirmRemove(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onRemove}>
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          The widget and its settings leave this page. You can undo from the message that follows,
          or add it again from the marketplace.
        </p>
      </Modal>
    </>
  );
}

function UnknownWidget({ page, instance }: { page: PageId; instance: WidgetInstance | undefined }) {
  return (
    <section
      role="region"
      aria-label="Unavailable widget"
      className="flex h-full flex-col rounded border border-line bg-panel"
    >
      <EmptyState
        title="Widget unavailable"
        message={`Widget type “${instance?.widgetId ?? 'unknown'}” is not installed in this build.`}
        action={
          instance ? (
            <Button size="sm" onClick={() => removeWidgetFromPage(page, instance.instanceId)}>
              Remove from page
            </Button>
          ) : undefined
        }
      />
    </section>
  );
}

/**
 * Every widget on the grid: looks up the instance and its registered type, then renders it in
 * a WidgetShell wired to the widget's data query, the connection state, the stores (settings,
 * duplicate, collapse, remove with confirmation) and edit / view mode.
 */
export const WidgetFrame = memo(function WidgetFrame({
  page,
  instanceId,
}: {
  page: PageId;
  instanceId: string;
}) {
  const instance = useWidgetStore((s) => s.instances[instanceId]);
  const entry = instance ? widgetRegistry.getWidget(instance.widgetId) : undefined;
  if (!instance || !entry) return <UnknownWidget page={page} instance={instance} />;
  return <FrameBody page={page} instance={instance} entry={entry} />;
});
