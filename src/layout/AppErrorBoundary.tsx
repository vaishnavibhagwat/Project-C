import type { ReactNode } from 'react';
import { Button } from '@/components/Button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IconAlert, IconRefresh } from '@/components/Icons';

/** Full-page message for an error outside any widget (shell, navigation, dialogs). */
export function AppErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-fg">
      <div
        role="alert"
        className="flex max-w-md flex-col gap-3 rounded border border-line bg-panel p-6"
      >
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <IconAlert size={18} className="text-neg" />
          Something went wrong
        </h1>
        <p className="text-sm text-muted">
          The workstation hit an unexpected error and stopped drawing. Your layouts, widget settings
          and theme are saved in this browser and are not affected.
        </p>
        <p className="num rounded border border-line bg-bg p-2 text-xs text-muted">
          {error.message}
        </p>
        <div className="flex gap-2">
          <Button variant="primary" icon={IconRefresh} onClick={onRetry}>
            Try again
          </Button>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </div>
    </main>
  );
}

/**
 * Outermost error boundary. Widget render errors are caught by each widget's own boundary
 * (WidgetFrame) and data errors never throw, so this only sees failures in the app shell.
 * It sits outside every provider so its fallback renders even if a provider fails.
 */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary fallback={(error, reset) => <AppErrorFallback error={error} onRetry={reset} />}>
      {children}
    </ErrorBoundary>
  );
}
