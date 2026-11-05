import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, parseEndpoint } from '@/data/api';
import { WidgetFrame } from '@/grid/WidgetFrame';
import { EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import { widgetRegistry } from '@/registry/registry';
import { useWidgetStore } from '@/store/widgetStore';
import { renderWithProviders } from './render';

export interface WidgetStateCases {
  /** Validated data for the ready state (the widget's fixture). */
  data: () => unknown;
  /** A valid response with nothing to show. */
  emptyData: () => unknown;
  /** Text of the empty state. Most widgets use the frame's "No data available". */
  emptyText?: string | RegExp;
}

const INSTANCE_ID = 'state-test-instance';
const PAGE = 'workstation';

/**
 * The states every widget must handle, rendered through the real WidgetFrame (WidgetShell,
 * data query, live summary) with a stubbed fetcher: ready with mock data, empty, and an error
 * that recovers on Retry. Call once from each widget's test file.
 */
export function describeWidgetStates(widgetId: string, cases: WidgetStateCases): void {
  const initial = useWidgetStore.getState();

  /** Serve `body` for whichever endpoint the widget asks for, validated like the real API. */
  const serve =
    (body: () => unknown): EndpointFetcher =>
    (endpoint) =>
      Promise.resolve().then(() => parseEndpoint(endpoint, body()));

  function renderFrame(fetcher: EndpointFetcher) {
    const entry = widgetRegistry.getWidget(widgetId);
    if (!entry) throw new Error(`${widgetId} is not registered`);
    useWidgetStore.getState().upsertInstances([
      {
        instanceId: INSTANCE_ID,
        widgetId,
        config: entry.defaultConfig,
        position: { x: 0, y: 0, ...entry.defaultSize },
      },
    ]);
    const ui: ReactElement = (
      <EndpointFetcherContext.Provider value={fetcher}>
        <WidgetFrame page={PAGE} instanceId={INSTANCE_ID} />
      </EndpointFetcherContext.Provider>
    );
    renderWithProviders(ui);
    return screen.getByRole('region', { name: entry.name });
  }

  describe(`${widgetId} widget states`, () => {
    afterEach(() => useWidgetStore.setState(initial, true));

    it('renders mock data in a labelled region with a visually hidden summary', async () => {
      const region = renderFrame(serve(cases.data));
      const live = region.querySelector('[aria-live="polite"]');
      await waitFor(() => expect(live?.textContent?.trim()).not.toBe(''));
      expect(live).toHaveClass('sr-only');
      expect(screen.queryByText('No data available')).not.toBeInTheDocument();
    });

    it('shows its empty state for an empty response', async () => {
      renderFrame(serve(cases.emptyData));
      expect(await screen.findByText(cases.emptyText ?? 'No data available')).toBeInTheDocument();
    });

    it('shows the error with Retry, and recovers', async () => {
      let fail = true;
      const ready = serve(cases.data);
      const region = renderFrame((endpoint, options) =>
        fail
          ? Promise.reject(new ApiError('Simulated 503 from the mock API'))
          : ready(endpoint, options),
      );
      expect(await screen.findByText(/Simulated 503 from the mock API/)).toBeInTheDocument();
      fail = false;
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      const live = region.querySelector('[aria-live="polite"]');
      await waitFor(() => expect(live?.textContent?.trim()).not.toBe(''));
    });
  });
}
