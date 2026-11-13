import { memo, useDeferredValue, useMemo } from 'react';
import { WidgetShell, type WidgetShellStatus } from '@/components/WidgetShell';
import { WidgetSkeleton } from '@/components/WidgetSkeleton';
import { useElementSize } from '@/hooks/useElementSize';
import { useDataSource } from '@/hooks/useEndpoint';
import { useNow } from '@/hooks/useNow';
import { useRegistryVersion } from '@/registry/pluginHost';
import { widgetRegistry } from '@/registry/registry';
import { UnknownWidgetPlaceholder, WidgetRenderer } from '@/registry/WidgetRenderer';
import type { RegisteredWidget } from '@/registry/defineWidget';
import type { WidgetInstance } from '@/types';
import { formatIstTime, isStale, toIstIso } from '@/utils/time';

function Body({ instance, entry }: { instance: WidgetInstance; entry: RegisteredWidget }) {
  const source = useMemo(
    () =>
      instance.dataSource?.refreshInterval === undefined
        ? entry.dataSource
        : { ...entry.dataSource, refreshInterval: instance.dataSource.refreshInterval },
    [entry.dataSource, instance.dataSource?.refreshInterval],
  );
  const query = useDataSource(source);
  const data = useDeferredValue(query.data);
  const now = useNow(5000);
  const [bodyRef, size] = useElementSize<HTMLDivElement>();
  const config = useMemo(() => entry.resolveConfig(instance.config), [entry, instance.config]);
  const title = instance.title ?? entry.name;

  let status: WidgetShellStatus;
  if (query.isPending || (data === undefined && !query.isError)) status = 'loading';
  else if (data === undefined) status = 'error';
  else status = entry.isEmpty(data) ? 'empty' : 'ready';
  const updated = query.dataUpdatedAt;

  return (
    <WidgetShell
      title={title}
      status={status}
      skeleton={<WidgetSkeleton variant={entry.skeleton} />}
      errorMessage={query.error?.message ?? 'Unknown error.'}
      onRetry={() => void query.refetch()}
      retrying={query.isFetching}
      emptyMessage={entry.emptyMessage}
      lastUpdated={updated > 0 ? formatIstTime(updated) : null}
      stale={data !== undefined && isStale(updated, source.refreshInterval, now)}
      summary={data === undefined ? '' : entry.summarize(data, instance.config)}
      bodyRef={bodyRef}
      testId={`shared-widget-${instance.instanceId}`}
    >
      {size.width > 0 && data !== undefined ? (
        <WidgetRenderer
          instance={instance}
          config={config}
          data={data}
          isLoading={query.isFetching}
          error={query.isError ? query.error : null}
          lastUpdated={updated > 0 ? toIstIso(updated) : null}
          width={size.width}
          height={size.height}
          onRetry={() => void query.refetch()}
        />
      ) : null}
    </WidgetShell>
  );
}

/**
 * A widget shown read-only (shared layouts): the same shell, states and live data as on the
 * grid, but no drag handle, settings, collapse or remove, and settings changes go nowhere.
 */
export const ReadOnlyWidget = memo(function ReadOnlyWidget({
  instance,
}: {
  instance: WidgetInstance;
}) {
  useRegistryVersion();
  const entry = widgetRegistry.getWidget(instance.widgetId);
  if (!entry) {
    return (
      <WidgetShell title="Unavailable widget" status="ready">
        <UnknownWidgetPlaceholder widgetId={instance.widgetId} />
      </WidgetShell>
    );
  }
  return <Body instance={instance} entry={entry} />;
});
