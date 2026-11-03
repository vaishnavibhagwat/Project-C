import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/Button';
import { IconAlert, IconRefresh } from '@/components/Icons';
import { isChunkLoadError } from './defineWidget';

export interface WidgetErrorBoundaryProps {
  /** Widget name (or the user's title), shown in the fallback. */
  name: string;
  /**
   * The widget, as a function of the attempt number. Retry increments it, so the subtree is
   * remounted (fresh state) and WidgetRenderer can create a fresh lazy component.
   */
  children: (attempt: number) => ReactNode;
  /** Also called on Retry, e.g. to refetch the widget's data. */
  onRetry?: () => void;
  /** When any key changes (new data, new settings), a caught error is cleared. */
  resetKeys?: readonly unknown[];
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface WidgetErrorBoundaryState {
  error: Error | null;
  attempt: number;
}

/** What one widget shows when it fails: its name, what went wrong and Retry. */
export function WidgetErrorFallback({
  name,
  error,
  onRetry,
}: {
  name: string;
  error: Error;
  onRetry: () => void;
}) {
  const chunk = isChunkLoadError(error);
  return (
    <div
      role="alert"
      className="flex h-full min-h-[80px] flex-col items-center justify-center gap-1.5 px-4 py-3 text-center"
    >
      <IconAlert size={20} className="text-neg" />
      <p className="text-sm font-medium text-fg">
        {chunk ? 'Failed to load widget' : `${name} failed to render`}
      </p>
      <p className="max-w-xs text-xs text-muted">
        {chunk ? `${name}: ${error.message} Check the connection and retry.` : error.message}
      </p>
      <div className="mt-1">
        <Button size="sm" icon={IconRefresh} onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}

/**
 * Error boundary around one widget. A render error or a failed chunk load stays inside this
 * widget: it shows WidgetErrorFallback and every other widget keeps working. Retry remounts
 * the widget (a new `attempt`), which for a chunk failure also loads the code again.
 */
export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  override state: WidgetErrorBoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<WidgetErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  override componentDidUpdate(prev: WidgetErrorBoundaryProps): void {
    if (!this.state.error) return;
    const a = prev.resetKeys ?? [];
    const b = this.props.resetKeys ?? [];
    if (a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))) this.remount();
  }

  private remount = (): void => {
    this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
  };

  retry = (): void => {
    this.remount();
    this.props.onRetry?.();
  };

  override render(): ReactNode {
    const { error, attempt } = this.state;
    if (error)
      return <WidgetErrorFallback name={this.props.name} error={error} onRetry={this.retry} />;
    return <Fragment key={attempt}>{this.props.children(attempt)}</Fragment>;
  }
}
