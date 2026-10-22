import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionProvider } from '@/components/MotionProvider';
import { ToastProvider } from '@/components/Toast';
import { getConnectionState, subscribeConnection } from '@/data/connection';
import { AppErrorBoundary } from '@/layout/AppErrorBoundary';
import { AppRouter } from '@/layout/AppRoutes';

/** Queries pause while the simulated feed is down and resume (refetch) when it returns. */
onlineManager.setEventListener((setOnline) => {
  setOnline(getConnectionState().connected);
  return subscribeConnection((state) => setOnline(state.connected));
});

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Validation failures are deterministic; retrying them only delays the error state.
        retry: (count, error) => error.name !== 'ValidationError' && count < 2,
        retryDelay: 800,
        refetchOnWindowFocus: false,
        gcTime: 5 * 60_000,
      },
    },
  });
}

const queryClient = createQueryClient();

export function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MotionProvider>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </MotionProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
