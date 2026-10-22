import {
  memo,
  Profiler,
  Suspense,
  useCallback,
  useDeferredValue,
  useMemo,
  type ReactNode,
} from 'react';
import { Button, IconButton } from '@/components/Button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  IconAlert,
  IconClose,
  IconCopy,
  IconDrag,
  IconRefresh,
  IconSettings,
  IconWifiOff,
} from '@/components/Icons';
import { DisconnectedState, EmptyState, ErrorState } from '@/components/StateViews';
import { useToast } from '@/components/Toast';
import { InfoTooltip } from '@/components/Tooltip';
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
} from '@/store/actions';
import { useWidgetStore } from '@/store/widgetStore';
import type { PageId, WidgetConfig, WidgetInstance } from '@/types';
import { cx } from '@/utils/cx';
import { recordWidgetRender } from '@/utils/perf';
import { formatIstTime, toIstIso } from '@/utils/time';

export const DRAG_HANDLE_CLASS = 'widget-drag-handle';
export const NO_DRAG_CLASS = 'widget-no-drag';

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
  const liveSummary = useThrottledValue(summary, 15_000);
  const updated = dataUpdatedAt > 0 ? formatIstTime(dataUpdatedAt) : null;
  const lastUpdated = dataUpdatedAt > 0 ? toIstIso(dataUpdatedAt) : null;
  const { instanceId } = instance;

  const onConfigChange = useCallback(
    (patch: Partial<WidgetConfig>) => updateConfig(instanceId, patch),
    [instanceId, updateConfig],
  );

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onRemove = useCallback(() => {
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

  let body: ReactNode;
  if (disconnected && data === undefined) {
    body = (
      <DisconnectedState
        since={formatIstTime(connection.changedAt, false)}
        onReconnect={() => {
          setSimulatedOutage(false);
          onRefresh();
        }}
      />
    );
  } else if (isPending) {
    body = <WidgetSkeleton variant={entry.skeleton} />;
  } else if (isError && data === undefined) {
    body = <ErrorState message={errorMessage(error)} onRetry={onRefresh} retrying={isFetching} />;
  } else if (data === undefined) {
    // The deferred value can trail the query by one render; keep the skeleton meanwhile.
    body = <WidgetSkeleton variant={entry.skeleton} />;
  } else if (data !== undefined && entry.isEmpty(data)) {
    body = <EmptyState message="The data source returned no rows for this widget." />;
  } else {
    body = (
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
          {size.width > 0 ? (
            <Profiler id={entry.id} onRender={recordWidgetRender}>
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
    );
  }

  return (
    <section
      role="region"
      aria-label={title}
      aria-busy={isFetching}
      data-stale={stale || undefined}
      data-testid={`widget-${instanceId}`}
      className={cx(
        'flex h-full flex-col overflow-hidden rounded border bg-panel',
        stale ? 'border-warn' : 'border-line',
      )}
    >
      <header className="flex h-8 shrink-0 items-center gap-1 border-b border-line pl-1 pr-1">
        <div
          className={cx(
            DRAG_HANDLE_CLASS,
            'flex min-w-0 flex-1 cursor-grab items-center gap-1 active:cursor-grabbing',
          )}
        >
          <IconDrag size={14} className="shrink-0 text-subtle" />
          <h2 className="truncate text-xs font-semibold text-fg">{title}</h2>
        </div>
        <div className={cx(NO_DRAG_CLASS, 'flex shrink-0 items-center gap-0.5')}>
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
              </>
            }
          />
          {updated ? (
            <span
              className={cx(
                'num hidden whitespace-nowrap px-1 text-2xs sm:inline',
                stale ? 'font-medium text-warn' : 'text-subtle',
              )}
              title={
                stale
                  ? `Data is older than ${STALE_MULTIPLIER}× the ${Math.round(refresh / 1000)}s refresh interval`
                  : 'Last updated'
              }
            >
              {stale ? (
                <>
                  <IconAlert size={11} className="mr-0.5 inline align-[-1px]" />
                  Stale · {updated}
                </>
              ) : (
                updated
              )}
            </span>
          ) : null}
          <IconButton
            label="Refresh"
            icon={IconRefresh}
            size="xs"
            onClick={onRefresh}
            disabled={disconnected}
          />
          <IconButton
            label={`Configure ${title}`}
            icon={IconSettings}
            size="xs"
            onClick={() => openSettings(instanceId)}
          />
          <IconButton
            label={`Duplicate ${title}`}
            icon={IconCopy}
            size="xs"
            onClick={onDuplicate}
          />
          <IconButton label={`Remove ${title}`} icon={IconClose} size="xs" onClick={onRemove} />
        </div>
      </header>
      {data !== undefined && disconnected ? (
        <p
          role="status"
          className="flex shrink-0 items-center gap-1.5 border-b border-warn/30 bg-warn/10 px-3 py-1 text-2xs text-warn"
        >
          <IconWifiOff size={12} /> Disconnected · showing data from {updated ?? 'earlier'}
        </p>
      ) : null}
      {data !== undefined && isError && !disconnected ? (
        <p
          role="alert"
          className="flex shrink-0 items-center gap-1.5 border-b border-neg/30 bg-neg/10 px-3 py-1 text-2xs text-neg"
        >
          <IconAlert size={12} /> Refresh failed · showing last good data
          <button type="button" onClick={onRefresh} className="ml-auto font-semibold underline">
            Retry
          </button>
        </p>
      ) : null}
      <div
        ref={bodyRef}
        data-widget-body
        className={cx(
          'relative min-h-0 flex-1',
          disconnected && data !== undefined && 'opacity-70',
        )}
      >
        {body}
      </div>
      <p className="sr-only" aria-live="polite">
        {liveSummary}
      </p>
    </section>
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

/** Frame around every widget: header, actions and all loading / error / stale states. */
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
