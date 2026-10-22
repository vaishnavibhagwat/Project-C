import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MotionProvider } from '@/components/MotionProvider';
import { ToastProvider } from '@/components/Toast';
import { SymbolDetailContext, type SymbolDetailApi } from '@/hooks/useSymbolDetail';

/**
 * Same providers as the app, with a fresh query cache per story and an in-memory router
 * starting at `route` (a story can set `parameters.route`, e.g. "/risk").
 */
export function StoryProviders({
  children,
  route = '/workstation',
}: {
  children: ReactNode;
  route?: string;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
      }),
  );
  const [opened, setOpened] = useState<string | null>(null);
  const symbolApi = useMemo<SymbolDetailApi>(() => ({ openSymbol: setOpened }), []);
  return (
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={client}>
        <MotionProvider>
          <ToastProvider>
            <SymbolDetailContext.Provider value={symbolApi}>
              <div className="min-h-[200px] bg-bg font-sans text-fg">
                {children}
                {opened ? (
                  <p role="status" className="mt-2 text-xs text-muted">
                    Symbol detail requested: {opened}
                  </p>
                ) : null}
              </div>
            </SymbolDetailContext.Provider>
          </ToastProvider>
        </MotionProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}
