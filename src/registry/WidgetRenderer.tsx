import { Suspense, useMemo, type ReactNode } from 'react';
import { LoadingSkeleton, type SkeletonShape } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/StateViews';
import type { WidgetConfig, WidgetInstance } from '@/types';
import type { RegisteredWidget, SkeletonVariant } from './defineWidget';
import { widgetRegistry } from './registry';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';

/** The generic LoadingSkeleton shape closest to a widget's own skeleton. */
export function skeletonShapeFor(variant: SkeletonVariant): SkeletonShape {
  switch (variant) {
    case 'table':
    case 'feed':
      return 'table';
    case 'tiles':
      return 'text';
    case 'line-chart':
    case 'area-chart':
    case 'bars':
      return 'chart';
    default:
      return 'widget';
  }
}

/** Shown in place of a widget whose type is not in the registry (removed or renamed). */
export function UnknownWidgetPlaceholder({
  widgetId,
  action,
}: {
  widgetId: string;
  action?: ReactNode;
}) {
  return (
    <div data-testid="unknown-widget" className="h-full">
      <EmptyState
        title="Widget unavailable"
        message={`Widget type “${widgetId}” is not installed in this build.`}
        action={action}
      />
    </div>
  );
}

export interface WidgetRendererProps {
  instance: WidgetInstance;
  /** Validated response of the widget's data source. */
  data: unknown;
  /** Settings merged over the widget's defaults (falls back to the instance's own). */
  config?: WidgetConfig;
  isLoading?: boolean;
  error?: Error | null;
  isStale?: boolean;
  lastUpdated?: string | null;
  onConfigChange?: (patch: Partial<WidgetConfig>) => void;
  width?: number;
  height?: number;
  /** Called on Retry after an error (e.g. refetch the data). */
  onRetry?: () => void;
  /** Clear a caught error when any of these change (new data, new settings). */
  resetKeys?: readonly unknown[];
  /** Shown for an unknown widget type, e.g. a Remove button. */
  unknownAction?: ReactNode;
  /** Look-up source; the app's registry by default (tests can pass their own). */
  lookup?: (widgetId: string) => RegisteredWidget | undefined;
}

const noop = () => undefined;
const defaultLookup = (id: string) => widgetRegistry.getWidget(id);

/**
 * Renders one widget instance: looks up its definition in the registry and renders
 * `definition.component` (lazy) inside Suspense, with a LoadingSkeleton while its chunk loads,
 * inside a WidgetErrorBoundary so a render error or chunk-load failure stays in this widget.
 * Unknown widget types render a placeholder instead of throwing.
 */
export function WidgetRenderer({
  instance,
  data,
  config,
  isLoading = false,
  error = null,
  isStale = false,
  lastUpdated = null,
  onConfigChange = noop,
  width = 0,
  height = 0,
  onRetry,
  resetKeys,
  unknownAction,
  lookup = defaultLookup,
}: WidgetRendererProps) {
  const entry = lookup(instance.widgetId);
  if (!entry)
    return <UnknownWidgetPlaceholder widgetId={instance.widgetId} action={unknownAction} />;
  const name = instance.title ?? entry.name;
  return (
    <WidgetErrorBoundary
      name={name}
      onRetry={onRetry}
      resetKeys={resetKeys ?? [data, instance.config]}
    >
      {(attempt) => (
        <LoadedWidget
          entry={entry}
          attempt={attempt}
          instanceId={instance.instanceId}
          config={config ?? entry.resolveConfig(instance.config)}
          data={data}
          isLoading={isLoading}
          error={error}
          isStale={isStale}
          lastUpdated={lastUpdated}
          onConfigChange={onConfigChange}
          width={width}
          height={height}
        />
      )}
    </WidgetErrorBoundary>
  );
}

interface LoadedWidgetProps {
  entry: RegisteredWidget;
  attempt: number;
  instanceId: string;
  config: WidgetConfig;
  data: unknown;
  isLoading: boolean;
  error: Error | null;
  isStale: boolean;
  lastUpdated: string | null;
  onConfigChange: (patch: Partial<WidgetConfig>) => void;
  width: number;
  height: number;
}

function LoadedWidget({ entry, attempt, ...props }: LoadedWidgetProps) {
  // The first attempt uses the registered lazy component (its chunk may already be loaded);
  // a retry gets a fresh one, because React never retries a lazy component that failed.
  const Widget = useMemo(
    () => (attempt === 0 ? entry.component : entry.createComponent()),
    [attempt, entry],
  );
  return (
    <Suspense fallback={<LoadingSkeleton shape={skeletonShapeFor(entry.skeleton)} />}>
      <Widget {...props} />
    </Suspense>
  );
}
