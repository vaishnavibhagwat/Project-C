import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '@/data/api';
import { ApiError, fetchEndpoint, parseEndpoint } from '@/data/api';
import { getConnectionState, setSimulatedOutage } from '@/data/connection';
import { WidgetFrame, isStale } from '@/grid/WidgetFrame';
import { endpointKey } from '@/hooks/useEndpoint';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import { fixture } from './fixtures';
import { createTestQueryClient, renderWithProviders } from './render';

vi.mock('@/data/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, fetchEndpoint: vi.fn() };
});

const fetchMock = vi.mocked(fetchEndpoint);
const OVERVIEW = 'workstation-portfolio-overview';
const HOLDINGS = 'workstation-holdings-table';
const initialWidgets = useWidgetStore.getState();
const initialDashboard = useDashboardStore.getState();
const never = () => new Promise<never>(() => undefined);

beforeEach(() => {
  fetchMock.mockReset();
  useWidgetStore.setState(initialWidgets, true);
  useDashboardStore.setState(initialDashboard, true);
});

describe('isStale', () => {
  it('flags data older than twice the refresh interval', () => {
    expect(isStale(1000, 5000, 1000 + 10_000)).toBe(false);
    expect(isStale(1000, 5000, 1000 + 10_001)).toBe(true);
    expect(isStale(0, 5000, 99_999)).toBe(false);
  });
});

describe('WidgetFrame states', () => {
  it('shows a widget-shaped skeleton while loading', () => {
    fetchMock.mockImplementation(never);
    renderWithProviders(<WidgetFrame page="workstation" instanceId={OVERVIEW} />);
    expect(screen.getByRole('region', { name: 'Portfolio Overview' })).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-tiles')).toBeInTheDocument();
  });

  it('renders data with an accessible region, header actions and a live summary', async () => {
    fetchMock.mockResolvedValue(fixture('portfolio/summary'));
    renderWithProviders(<WidgetFrame page="workstation" instanceId={OVERVIEW} />);
    expect(await screen.findByText('$45.0B')).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Portfolio Overview' });
    expect(region.querySelector('[aria-live="polite"]')?.textContent).toMatch(/AUM \$45\.0B/);
    for (const name of [/^Refresh$/, /Configure/, /Duplicate/, /Remove/]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('renders widget bodies under React StrictMode (dev double effects)', async () => {
    fetchMock.mockResolvedValue(fixture('portfolio/summary'));
    renderWithProviders(
      <StrictMode>
        <WidgetFrame page="workstation" instanceId={OVERVIEW} />
      </StrictMode>,
    );
    expect(await screen.findByText('$45.0B')).toBeInTheDocument();
  });

  it('shows the error state with a message and recovers on Retry', async () => {
    fetchMock.mockRejectedValueOnce(
      new ApiError('GET /api/portfolio/summary returned 503 (simulated upstream failure)'),
    );
    fetchMock.mockResolvedValue(fixture('portfolio/summary'));
    renderWithProviders(<WidgetFrame page="workstation" instanceId={OVERVIEW} />);
    expect(
      await screen.findByText(/GET \/api\/portfolio\/summary returned 503/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('$45.0B')).toBeInTheDocument();
  });

  it('shows "No data available" for an empty response', async () => {
    const base = fixture('portfolio/holdings');
    fetchMock.mockResolvedValue(parseEndpoint('portfolio/holdings', { ...base, holdings: [] }));
    renderWithProviders(<WidgetFrame page="workstation" instanceId={HOLDINGS} />);
    expect(await screen.findByText('No data available')).toBeInTheDocument();
  });

  it('marks data older than 2x the refresh interval as stale, with a timestamp', async () => {
    fetchMock.mockImplementation(never);
    const client = createTestQueryClient();
    client.setQueryData(endpointKey('portfolio/summary'), fixture('portfolio/summary'), {
      updatedAt: Date.now() - 60_000,
    });
    renderWithProviders(<WidgetFrame page="workstation" instanceId={OVERVIEW} />, { client });
    const region = screen.getByRole('region', { name: 'Portfolio Overview' });
    await waitFor(() => expect(region).toHaveAttribute('data-stale', 'true'));
    expect(region.className).toContain('border-warn');
    expect(screen.getByText(/Stale ·/)).toHaveTextContent(/IST/);
  });

  it('shows the disconnected state and reconnects', async () => {
    fetchMock.mockImplementation(never);
    act(() => setSimulatedOutage(true));
    renderWithProviders(<WidgetFrame page="workstation" instanceId={OVERVIEW} />);
    expect(await screen.findByText('Data feed disconnected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(getConnectionState().connected).toBe(true);
  });

  it('keeps last data visible with a banner while disconnected', async () => {
    fetchMock.mockImplementation(never);
    const client = createTestQueryClient();
    client.setQueryData(endpointKey('portfolio/summary'), fixture('portfolio/summary'));
    act(() => setSimulatedOutage(true));
    renderWithProviders(<WidgetFrame page="workstation" instanceId={OVERVIEW} />, { client });
    expect(await screen.findByText(/Disconnected · showing data from/)).toBeInTheDocument();
    expect(await screen.findByText('$45.0B')).toBeInTheDocument();
  });

  it('removes the widget and offers Undo', async () => {
    fetchMock.mockResolvedValue(fixture('portfolio/summary'));
    renderWithProviders(<WidgetFrame page="workstation" instanceId={OVERVIEW} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    expect(useDashboardStore.getState().pages.workstation.itemIds).not.toContain(OVERVIEW);
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(useDashboardStore.getState().pages.workstation.itemIds).toContain(OVERVIEW);
  });

  it('passes the contract props and persists onConfigChange to the store', async () => {
    fetchMock.mockResolvedValue(fixture('portfolio/nav-history'));
    renderWithProviders(
      <WidgetFrame page="workstation" instanceId="workstation-nav-performance" />,
    );
    // First render loads the widget's lazy chunk (Recharts), so allow for a cold import.
    fireEvent.click(await screen.findByRole('radio', { name: '3Y' }, { timeout: 10_000 }));
    expect(useWidgetStore.getState().instances['workstation-nav-performance']?.config.range).toBe(
      '3Y',
    );
  }, 15_000);

  it('opens settings from the gear icon', () => {
    fetchMock.mockImplementation(never);
    renderWithProviders(<WidgetFrame page="workstation" instanceId={OVERVIEW} />);
    fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
    expect(useWidgetStore.getState().settingsFor).toBe(OVERVIEW);
  });

  it('explains when a widget type is not installed', () => {
    useWidgetStore.getState().upsertInstances([
      {
        instanceId: 'ghost',
        widgetId: 'ghost',
        config: {},
        position: { x: 0, y: 0, w: 4, h: 4 },
      },
    ]);
    renderWithProviders(<WidgetFrame page="workstation" instanceId="ghost" />);
    expect(screen.getByText('Widget unavailable')).toBeInTheDocument();
  });
});
