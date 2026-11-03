import { fireEvent, render, screen, within } from '@testing-library/react';
import { lazy } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError } from '@/data/api';
import { WidgetFrame } from '@/grid/WidgetFrame';
import { EndpointFetcherContext, type EndpointFetcher } from '@/hooks/useEndpoint';
import {
  GlobalErrorBoundary,
  GlobalErrorFallback,
  logGlobalError,
} from '@/layout/GlobalErrorBoundary';
import {
  defineWidget,
  isChunkLoadError,
  WidgetChunkLoadError,
  type RegisteredWidget,
} from '@/registry/defineWidget';
import { widgetRegistry } from '@/registry/registry';
import { WidgetRenderer } from '@/registry/WidgetRenderer';
import { useWidgetStore } from '@/store/widgetStore';
import {
  WidgetCategory,
  type WidgetComponentProps,
  type WidgetComponentType,
  type WidgetConfig,
  type WidgetInstance,
} from '@/types';
import { fixture } from './fixtures';
import { renderWithProviders } from './render';

const OVERVIEW = 'performance-portfolio-overview';
const CRASHING = 'crash-instance';
const initialWidgets = useWidgetStore.getState();

/** A minimal registered widget around `Body`, loaded by `preload`. */
function testWidget(
  id: string,
  Body: WidgetComponentType<WidgetConfig, unknown>,
  preload: () => Promise<unknown> = () => Promise.resolve(),
): RegisteredWidget {
  return defineWidget<WidgetConfig, unknown>(
    {
      id,
      name: `Widget ${id}`,
      description: 'Test widget.',
      category: WidgetCategory.CHART,
      defaultSize: { w: 4, h: 3 },
      minSize: { w: 2, h: 2 },
      configSchema: { type: 'object', properties: {} },
      defaultConfig: {},
      component: lazy(() => Promise.resolve({ default: Body })),
      icon: () => null,
      dataSource: { endpoint: 'portfolio/summary', refreshInterval: 60_000, latencyProfile: 'low' },
    },
    {
      configParser: z.record(z.union([z.string(), z.number(), z.boolean()])),
      isData: (value): value is unknown => value !== undefined,
      summarize: () => '',
      skeleton: 'line-chart',
      preload,
    },
  );
}

function instance(widgetId: string, instanceId = `${widgetId}-1`): WidgetInstance {
  return { instanceId, widgetId, config: {}, position: { x: 0, y: 0, w: 4, h: 3 } };
}

function Crash(): never {
  throw new Error('chart received an unexpected shape');
}

function Healthy({ instanceId }: WidgetComponentProps<WidgetConfig, unknown>) {
  return <p>{instanceId} is fine</p>;
}

const crashingWidget = testWidget('crash-test', Crash);
const fixtureFetcher: EndpointFetcher = (endpoint) => Promise.resolve(fixture(endpoint));

beforeAll(() => widgetRegistry.registerWidget(crashingWidget));
afterAll(() => widgetRegistry.unregisterWidget(crashingWidget.id));

beforeEach(() => {
  useWidgetStore.setState(initialWidgets, true);
  // React logs every caught render error; keep the test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('WidgetRenderer', () => {
  it('looks up the definition and renders its lazy component, with a skeleton meanwhile', async () => {
    const healthy = testWidget('healthy', Healthy);
    render(<WidgetRenderer instance={instance('healthy')} data={{}} lookup={() => healthy} />);
    expect(screen.getByTestId('loading-skeleton-chart')).toBeInTheDocument();
    expect(await screen.findByText('healthy-1 is fine')).toBeInTheDocument();
  });

  it('renders a placeholder for an unknown widget type', () => {
    render(
      <WidgetRenderer instance={instance('retired-widget')} data={{}} lookup={() => undefined} />,
    );
    expect(screen.getByText('Widget unavailable')).toBeInTheDocument();
    expect(screen.getByText(/“retired-widget” is not installed/)).toBeInTheDocument();
  });

  it('shows the widget name, the error and Retry, which remounts the widget', async () => {
    let failing = true;
    const mounts = vi.fn();
    function Flaky() {
      mounts();
      if (failing) throw new Error('series is empty');
      return <p>Recovered</p>;
    }
    const flaky = testWidget('flaky', Flaky);
    const onRetry = vi.fn();
    render(
      <WidgetRenderer
        instance={{ ...instance('flaky'), title: 'Desk NAV' }}
        data={{}}
        onRetry={onRetry}
        lookup={() => flaky}
      />,
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Desk NAV failed to render');
    expect(alert).toHaveTextContent('series is empty');
    const before = mounts.mock.calls.length;
    failing = false;
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Recovered')).toBeInTheDocument();
    expect(mounts.mock.calls.length).toBeGreaterThan(before);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows "Failed to load widget" when its chunk fails, and Retry loads it again', async () => {
    let offline = true;
    const preload = vi.fn(() =>
      offline
        ? Promise.reject(new TypeError('Failed to fetch dynamically imported module: /nav.js'))
        : Promise.resolve(),
    );
    const chunky = testWidget('chunky', Healthy, preload);
    render(<WidgetRenderer instance={instance('chunky')} data={{}} lookup={() => chunky} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to load widget');
    expect(alert).toHaveTextContent('Widget chunky');
    offline = false;
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('chunky-1 is fine')).toBeInTheDocument();
    expect(preload).toHaveBeenCalledTimes(2);
  });

  it('one widget throwing or failing to load never affects the others', async () => {
    const healthy = testWidget('healthy', Healthy);
    const broken = testWidget('broken', Crash);
    const unloadable = testWidget('unloadable', Healthy, () =>
      Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED')),
    );
    const byId: Record<string, RegisteredWidget> = { healthy, broken, unloadable };
    const lookup = (id: string) => byId[id];
    render(
      <GlobalErrorBoundary>
        <WidgetRenderer instance={instance('healthy', 'a')} data={{}} lookup={lookup} />
        <WidgetRenderer instance={instance('broken', 'b')} data={{}} lookup={lookup} />
        <WidgetRenderer instance={instance('healthy', 'c')} data={{}} lookup={lookup} />
        <WidgetRenderer instance={instance('unloadable', 'd')} data={{}} lookup={lookup} />
        <WidgetRenderer instance={instance('healthy', 'e')} data={{}} lookup={lookup} />
      </GlobalErrorBoundary>,
    );
    expect(await screen.findByText('a is fine')).toBeInTheDocument();
    expect(screen.getByText('c is fine')).toBeInTheDocument();
    expect(screen.getByText('e is fine')).toBeInTheDocument();
    expect(await screen.findByText('Widget broken failed to render')).toBeInTheDocument();
    expect(await screen.findByText('Failed to load widget')).toBeInTheDocument();
    expect(screen.queryByText('The dashboard stopped working')).toBeNull();
  });
});

describe('chunk-load errors', () => {
  it('recognises our error and the browsers’ dynamic-import failures', () => {
    expect(isChunkLoadError(new WidgetChunkLoadError('nav', new Error('offline')))).toBe(true);
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: x'))).toBe(
      true,
    );
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('chart received an unexpected shape'))).toBe(false);
    expect(isChunkLoadError('not an error')).toBe(false);
  });
});

describe('GlobalErrorBoundary', () => {
  it('shows a full-page Reload Dashboard screen, logs the stack trace and can retry', () => {
    let broken = true;
    function Shell() {
      if (broken) throw new Error('navigation failed');
      return <p>Shell is back</p>;
    }
    render(
      <GlobalErrorBoundary>
        <Shell />
      </GlobalErrorBoundary>,
    );
    const screenAlert = screen.getByRole('alert');
    expect(screenAlert).toHaveTextContent('The dashboard stopped working');
    expect(screen.getByText('navigation failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload Dashboard' })).toBeInTheDocument();
    const logged = vi
      .mocked(console.error)
      .mock.calls.find((args) => String(args[0]).includes('[GlobalErrorBoundary]'));
    expect(String(logged?.[1])).toContain('navigation failed');
    expect(String(logged?.[1])).toMatch(/at Shell|Shell/);
    expect(String(logged?.[2])).toContain('Component stack');
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Shell is back')).toBeInTheDocument();
  });

  it('Reload Dashboard reloads the page', () => {
    const onReload = vi.fn();
    render(<GlobalErrorFallback error={new Error('boom')} onRetry={vi.fn()} onReload={onReload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reload Dashboard' }));
    expect(onReload).toHaveBeenCalled();
  });

  it('logs the stack, or name and message when there is no stack', () => {
    const error = new Error('no stack here');
    error.stack = undefined;
    logGlobalError(error);
    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      expect.stringContaining('[GlobalErrorBoundary]'),
      'Error: no stack here',
      '',
    );
  });
});

describe('error boundary hierarchy on the grid', () => {
  it('a widget that throws is contained and its neighbours keep working', async () => {
    useWidgetStore.getState().upsertInstances([instance('crash-test', CRASHING)]);
    renderWithProviders(
      <EndpointFetcherContext.Provider value={fixtureFetcher}>
        <GlobalErrorBoundary>
          <WidgetFrame page="workstation" instanceId={CRASHING} />
          <WidgetFrame page="performance" instanceId={OVERVIEW} />
        </GlobalErrorBoundary>
      </EndpointFetcherContext.Provider>,
    );
    expect(await screen.findByText('Widget crash-test failed to render')).toBeInTheDocument();
    expect(screen.getByText('chart received an unexpected shape')).toBeInTheDocument();
    expect(await screen.findByText('$45.0B')).toBeInTheDocument();
    expect(screen.queryByText('The dashboard stopped working')).not.toBeInTheDocument();
  });

  it('an unknown widget type renders a placeholder with Remove, inside the grid', () => {
    useWidgetStore.getState().upsertInstances([instance('ghost', 'ghost-1')]);
    renderWithProviders(<WidgetFrame page="workstation" instanceId="ghost-1" />);
    expect(screen.getByRole('region', { name: 'Unavailable widget' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove from page' })).toBeInTheDocument();
  });

  it('data: a failed request becomes the widget error state, never a thrown error', async () => {
    const failing: EndpointFetcher = () =>
      Promise.reject(new ApiError('GET /api/portfolio/summary returned 503'));
    renderWithProviders(
      <EndpointFetcherContext.Provider value={failing}>
        <GlobalErrorBoundary>
          <WidgetFrame page="performance" instanceId={OVERVIEW} />
        </GlobalErrorBoundary>
      </EndpointFetcherContext.Provider>,
    );
    expect(await screen.findByText(/returned 503/, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText(/failed to render/)).not.toBeInTheDocument();
  });
});
