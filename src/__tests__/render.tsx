import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { MotionConfig } from 'framer-motion';
import type { ReactElement, ReactNode } from 'react';
import { MotionProvider } from '@/components/MotionProvider';
import { ToastProvider } from '@/components/Toast';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, refetchOnWindowFocus: false } },
  });
}

/** Render with the same providers the app uses (query client, motion, toasts). */
export function renderWithProviders(
  ui: ReactElement,
  { client = createTestQueryClient(), ...options }: RenderOptions & { client?: QueryClient } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MotionProvider>
          <MotionConfig reducedMotion="always">
            <ToastProvider>{children}</ToastProvider>
          </MotionConfig>
        </MotionProvider>
      </QueryClientProvider>
    );
  }
  return { client, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/** Standard props for rendering a widget component directly with fixture data. */
export function widgetProps<C, D>(
  config: C,
  data: D,
  width = 800,
  height = 400,
  onConfigChange: (patch: Partial<C>) => void = () => undefined,
) {
  return {
    instanceId: 'test-instance',
    config,
    data,
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange,
    width,
    height,
  };
}
