import { fireEvent, render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError } from '@/data/api';
import { WidgetFrame } from '@/grid/WidgetFrame';
import { EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import { AppErrorBoundary } from '@/layout/AppErrorBoundary';
import { defineWidget } from '@/registry/defineWidget';
import { widgetRegistry } from '@/registry/registry';
import { useWidgetStore } from '@/store/widgetStore';
import { WidgetCategory, type WidgetComponentType, type WidgetConfig } from '@/types';
import { fixture } from './fixtures';
import { renderWithProviders } from './render';

const OVERVIEW = 'workstation-portfolio-overview';
const CRASHING = 'crash-instance';
const initialWidgets = useWidgetStore.getState();

function Crash(): never {
  throw new Error('chart received an unexpected shape');
}

/** A widget whose component always throws while rendering. */
const crashingWidget = defineWidget<WidgetConfig, unknown>(
  {
    id: 'crash-test',
    name: 'Crash test',
    description: 'Throws while rendering.',
    category: WidgetCategory.CHART,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 2 },
    configSchema: { type: 'object', properties: {} },
    defaultConfig: {},
    component: lazy<WidgetComponentType<WidgetConfig, unknown>>(() =>
      Promise.resolve({ default: Crash }),
    ),
    icon: () => null,
    dataSource: { endpoint: 'portfolio/summary', refreshInterval: 60_000, latencyProfile: 'low' },
  },
  {
    configParser: z.record(z.union([z.string(), z.number(), z.boolean()])),
    isData: (value): value is unknown => value !== undefined,
    summarize: () => '',
    skeleton: 'tiles',
    preload: () => Promise.resolve(),
  },
);

const fixtureFetcher: EndpointFetcher = (endpoint) => Promise.resolve(fixture(endpoint));

beforeAll(() => widgetRegistry.registerWidget(crashingWidget));
afterAll(() => widgetRegistry.unregisterWidget(crashingWidget.id));

beforeEach(() => {
  useWidgetStore.setState(initialWidgets, true);
  // React logs every caught render error; keep the test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('error boundary hierarchy', () => {
  it('global: shows a full-page message for errors outside widgets, and recovers', () => {
    let broken = true;
    function Shell() {
      if (broken) throw new Error('navigation failed');
      return <p>Shell is back</p>;
    }
    render(
      <AppErrorBoundary>
        <Shell />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByText('navigation failed')).toBeInTheDocument();
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Shell is back')).toBeInTheDocument();
  });

  it('widget: a widget that throws is contained and its neighbours keep working', async () => {
    useWidgetStore.getState().upsertInstances([
      {
        instanceId: CRASHING,
        widgetId: 'crash-test',
        config: {},
        position: { x: 0, y: 0, w: 4, h: 3 },
      },
    ]);
    renderWithProviders(
      <EndpointFetcherContext.Provider value={fixtureFetcher}>
        <AppErrorBoundary>
          <WidgetFrame page="workstation" instanceId={CRASHING} />
          <WidgetFrame page="workstation" instanceId={OVERVIEW} />
        </AppErrorBoundary>
      </EndpointFetcherContext.Provider>,
    );
    expect(
      await screen.findByText(/This widget failed to render: chart received an unexpected shape/),
    ).toBeInTheDocument();
    expect(await screen.findByText('$45.0B')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('data: a failed request becomes the widget error state, never a thrown error', async () => {
    const failing: EndpointFetcher = () =>
      Promise.reject(new ApiError('GET /api/portfolio/summary returned 503'));
    renderWithProviders(
      <EndpointFetcherContext.Provider value={failing}>
        <AppErrorBoundary>
          <WidgetFrame page="workstation" instanceId={OVERVIEW} />
        </AppErrorBoundary>
      </EndpointFetcherContext.Provider>,
    );
    expect(await screen.findByText(/returned 503/, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText(/failed to render/)).not.toBeInTheDocument();
  });
});
