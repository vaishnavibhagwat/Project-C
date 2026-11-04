import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fetchEndpoint } from '@/data/api';
import { getConnectionState } from '@/data/connection';
import {
  effectiveLatencyProfile,
  getDataControls,
  setLatencyOverride,
  setLiveUpdatesPaused,
  setSimulatedFailure,
} from '@/data/controls';
import { getPortfolio, MOCK_PORTFOLIO_ID, MockHttpError } from '@/data/mockApi';
import { startRealtimeBridge } from '@/data/realtime';
import { MARKET_TICKER_URL, WsSimulator, type MessageBuilder } from '@/data/wsSimulator';
import { EndpointFetcherContext, useEndpoint, type EndpointFetcher } from '@/hooks/useEndpoint';
import { DeveloperMenu, LiveUpdatesPausedBanner, LiveUpdatesToggle } from '@/layout/DevControls';
import { fixture } from './fixtures';
import { createTestQueryClient } from './render';

afterEach(() => {
  vi.useRealTimers();
});

describe('data controls', () => {
  it('"Simulate failure" makes every request fail with a 503, until switched off', async () => {
    setSimulatedFailure(true);
    await expect(
      fetchEndpoint('portfolio/summary', { latencyMs: 0, errorRate: 0 }),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      getPortfolio(MOCK_PORTFOLIO_ID, { latency: 'low', jitter: false, failureRate: 0 }),
    ).rejects.toBeInstanceOf(MockHttpError);
    setSimulatedFailure(false);
    await expect(
      fetchEndpoint('portfolio/summary', { latencyMs: 0, errorRate: 0 }),
    ).resolves.toMatchObject({ simulated: true });
  });

  it('the latency switch overrides every request profile; Auto keeps each widget’s own', () => {
    expect(effectiveLatencyProfile('high')).toBe('high');
    setLatencyOverride('low');
    expect(effectiveLatencyProfile('high')).toBe('low');
    expect(effectiveLatencyProfile()).toBe('low');
    setLatencyOverride(null);
    expect(effectiveLatencyProfile('high')).toBe('high');
  });

  it('pausing stops widget polling; the data stays and ages', async () => {
    vi.useFakeTimers();
    const data = fixture('portfolio/summary');
    const calls = vi.fn();
    const fetcher: EndpointFetcher = (endpoint) => {
      calls(endpoint);
      return Promise.resolve(fixture(endpoint));
    };
    const client = createTestQueryClient();
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={client}>
          <EndpointFetcherContext.Provider value={fetcher}>
            {children}
          </EndpointFetcherContext.Provider>
        </QueryClientProvider>
      );
    }
    const { result } = renderHook(() => useEndpoint('portfolio/summary', 1000), {
      wrapper: Wrapper,
    });
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(result.current.data?.portfolioId).toBe(data.portfolioId);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    const polled = calls.mock.calls.length;
    expect(polled).toBeGreaterThanOrEqual(3);

    act(() => setLiveUpdatesPaused(true));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(calls.mock.calls.length).toBe(polled);
    expect(result.current.data?.portfolioId).toBe(data.portfolioId);

    act(() => setLiveUpdatesPaused(false));
    await act(() => vi.advanceTimersByTimeAsync(1100));
    expect(calls.mock.calls.length).toBeGreaterThan(polled);
  });

  it('pausing ignores real-time pushes', async () => {
    vi.useFakeTimers();
    const build: MessageBuilder = () =>
      Promise.resolve({ type: 'ticker', session: 'open', quotes: [] });
    const sim = new WsSimulator({ build, latencyMs: 0 });
    sim.setFrequency(MARKET_TICKER_URL, 1000);
    const onPush = vi.fn();
    const stop = startRealtimeBridge(onPush, sim);
    sim.setFrequency(MARKET_TICKER_URL, 1000);
    await act(() => vi.advanceTimersByTimeAsync(1010));
    const before = onPush.mock.calls.length;
    expect(before).toBeGreaterThan(0);
    setLiveUpdatesPaused(true);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(onPush.mock.calls.length).toBe(before);
    stop();
    sim.destroy();
  });
});

describe('developer controls UI', () => {
  it('Pause / Resume toggles live updates and shows the paused banner', () => {
    render(
      <>
        <LiveUpdatesPausedBanner />
        <LiveUpdatesToggle />
      </>,
    );
    const pause = screen.getByRole('button', { name: 'Pause live updates' });
    expect(pause).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pause);
    expect(getDataControls().paused).toBe(true);
    expect(screen.getByRole('button', { name: 'Resume live updates' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Live updates paused.');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(getDataControls().paused).toBe(false);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('the developer menu sets latency, failure and disconnect', () => {
    render(<DeveloperMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Developer tools' }));
    fireEvent.click(screen.getByRole('radio', { name: 'High' }));
    expect(getDataControls().latencyProfile).toBe('high');
    fireEvent.click(screen.getByRole('switch', { name: 'Simulate failure' }));
    expect(getDataControls().simulateFailure).toBe(true);
    fireEvent.click(screen.getByRole('switch', { name: 'Simulate disconnect' }));
    expect(getConnectionState().simulatedOutage).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Developer tools (simulation active)' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(getDataControls().latencyProfile).toBeNull();
  });
});
