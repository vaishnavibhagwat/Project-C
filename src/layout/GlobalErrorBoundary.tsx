import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/Button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IconAlert, IconRefresh } from '@/components/Icons';

/** Write the error, its stack trace and React's component stack to the console. */
export function logGlobalError(error: Error, info?: Pick<ErrorInfo, 'componentStack'>): void {
  console.error(
    '[GlobalErrorBoundary] The dashboard stopped rendering.\n',
    error.stack ?? `${error.name}: ${error.message}`,
    info?.componentStack ? `\nComponent stack:${info.componentStack}` : '',
  );
}

export interface GlobalErrorFallbackProps {
  error: Error;
  /** Re-render the app without reloading. */
  onRetry: () => void;
  /** Reload the page; window.location.reload by default. */
  onReload?: () => void;
}

/** Full-page screen for an error outside any widget (shell, navigation, dialogs, providers). */
export function GlobalErrorFallback({
  error,
  onRetry,
  onReload = () => window.location.reload(),
}: GlobalErrorFallbackProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-fg">
      <div
        role="alert"
        className="flex w-full max-w-lg flex-col gap-3 rounded border border-line bg-panel p-6"
      >
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <IconAlert size={18} className="text-neg" />
          The dashboard stopped working
        </h1>
        <p className="text-sm text-muted">
          An unexpected error stopped the workstation from drawing. Your layouts, widget settings
          and theme are saved in this browser and are not affected. The full stack trace has been
          written to the browser console.
        </p>
        <p className="num rounded border border-line bg-bg p-2 text-xs text-muted">
          {error.message}
        </p>
        {error.stack ? (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer select-none">Technical details</summary>
            <pre className="scroll-thin mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-line bg-bg p-2 text-2xs">
              {error.stack}
            </pre>
          </details>
        ) : null}
        <div className="flex gap-2">
          <Button variant="primary" icon={IconRefresh} onClick={onReload}>
            Reload Dashboard
          </Button>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      </div>
    </main>
  );
}

/**
 * Outermost error boundary, at the app root outside every provider so its screen renders even
 * if a provider fails. Widget errors never reach it: each widget has its own
 * WidgetErrorBoundary (WidgetRenderer) and data errors never throw. It logs the stack trace.
 */
export function GlobalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={logGlobalError}
      fallback={(error, reset) => <GlobalErrorFallback error={error} onRetry={reset} />}
    >
      {children}
    </ErrorBoundary>
  );
}
