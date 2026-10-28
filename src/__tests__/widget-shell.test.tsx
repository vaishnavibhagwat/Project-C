import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadingSkeleton, type SkeletonShape } from '@/components/LoadingSkeleton';
import { WidgetShell, type WidgetShellProps } from '@/components/WidgetShell';
import { widgetRegistry } from '@/registry/registry';
import { COLLAPSED_ROWS, setWidgetCollapsed, undoLayoutChange } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import { filterAlerts } from '@/widgets/alerts-monitor/model';
import { fixture } from './fixtures';
import { renderWithProviders } from './render';

function renderShell(props: Partial<WidgetShellProps> = {}) {
  return renderWithProviders(
    <WidgetShell title="NAV vs Nifty 50" status="ready" {...props}>
      {props.children ?? <p>Chart body</p>}
    </WidgetShell>,
  );
}

const region = () => screen.getByRole('region', { name: 'NAV vs Nifty 50' });

describe('WidgetShell', () => {
  it('is a labelled region with a heading, body slot and polite live summary', () => {
    renderShell({ summary: 'Fund up 20.1%, Nifty 50 up 14.0%.' });
    expect(within(region()).getByRole('heading', { name: 'NAV vs Nifty 50' })).toBeInTheDocument();
    expect(screen.getByText('Chart body')).toBeInTheDocument();
    const live = screen.getByText('Fund up 20.1%, Nifty 50 up 14.0%.');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveClass('sr-only');
  });

  it('shows a shimmer skeleton, busy state and hidden "Loading" text while loading', () => {
    renderShell({ status: 'loading' });
    expect(region()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('loading-skeleton-widget')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Loading NAV vs Nifty 50')).toHaveClass('sr-only');
    expect(screen.queryByText('Chart body')).toBeNull();
  });

  it('uses a widget-specific skeleton when given one', () => {
    renderShell({ status: 'loading', skeleton: <div data-testid="custom-skeleton" /> });
    expect(screen.getByTestId('custom-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-skeleton-widget')).toBeNull();
  });

  it('shows a descriptive error with Retry', () => {
    const onRetry = vi.fn();
    renderShell({ status: 'error', errorMessage: 'Request timed out after 8 s.', onRetry });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Request timed out after 8 s.');
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows "No data available" for empty data', () => {
    renderShell({ status: 'empty', emptyMessage: 'No trades today.' });
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.getByText('No trades today.')).toBeInTheDocument();
  });

  it('shows the disconnected state with Reconnect', () => {
    const onReconnect = vi.fn();
    renderShell({ status: 'disconnected', disconnectedSince: '14:02 IST', onReconnect });
    expect(screen.getByText('Data feed disconnected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(onReconnect).toHaveBeenCalled();
  });

  it('shows the last-updated time, and an amber border with a Stale badge when stale', () => {
    const { rerender } = renderShell({ lastUpdated: '14:32:05 IST' });
    expect(screen.getByText('14:32:05 IST')).toHaveClass('text-subtle');
    expect(region().className).toContain('border-line');
    rerender(
      <WidgetShell
        title="NAV vs Nifty 50"
        status="ready"
        lastUpdated="14:32:05 IST"
        stale
        staleReason="Data is older than 2× the 15s refresh interval"
      >
        <p>Chart body</p>
      </WidgetShell>,
    );
    expect(region()).toHaveAttribute('data-stale', 'true');
    expect(region().className).toContain('border-warn');
    expect(screen.getByText('Stale')).toBeInTheDocument();
    expect(screen.getByText('14:32:05 IST')).toHaveClass('text-warn');
  });

  it('drops the plain timestamp in a compact header but always keeps the Stale badge', () => {
    const { rerender } = renderShell({ lastUpdated: '14:32:05 IST', compactHeader: true });
    expect(screen.queryByText('14:32:05 IST')).toBeNull();
    rerender(
      <WidgetShell
        title="NAV vs Nifty 50"
        status="ready"
        lastUpdated="14:32:05 IST"
        compactHeader
        stale
      >
        body
      </WidgetShell>,
    );
    expect(screen.getByText('Stale')).toBeInTheDocument();
  });

  it('shows an optional badge count, capped at 99+', () => {
    const { rerender } = renderShell({ badgeCount: 7 });
    expect(screen.getByTestId('header-badge')).toHaveTextContent('7');
    rerender(
      <WidgetShell title="NAV vs Nifty 50" status="ready" badgeCount={240}>
        body
      </WidgetShell>,
    );
    expect(screen.getByTestId('header-badge')).toHaveTextContent('99+');
    rerender(
      <WidgetShell title="NAV vs Nifty 50" status="ready" badgeCount={null}>
        body
      </WidgetShell>,
    );
    expect(screen.queryByTestId('header-badge')).toBeNull();
  });

  it('renders the footer slot', () => {
    renderShell({ footer: 'Source: simulated NAV series' });
    expect(within(region()).getByText('Source: simulated NAV series').tagName).toBe('FOOTER');
  });

  it('shows only the header controls it is given', () => {
    renderShell();
    expect(screen.queryByRole('button', { name: /Configure/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Collapse/ })).toBeNull();
  });

  it('calls settings and remove, and shows a drag grip when draggable', () => {
    const onSettings = vi.fn();
    const onRemove = vi.fn();
    const { container } = renderShell({ onSettings, onRemove, draggable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Configure NAV vs Nifty 50' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove NAV vs Nifty 50' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.widget-drag-handle')?.className).toContain('cursor-grab');
  });

  it('collapses to its header: body and footer hidden, toggle reports aria-expanded', () => {
    const onToggleCollapse = vi.fn();
    const { rerender } = renderShell({ footer: 'footer', onToggleCollapse, summary: 'Live' });
    const toggle = screen.getByRole('button', { name: 'Collapse NAV vs Nifty 50' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(onToggleCollapse).toHaveBeenCalled();
    rerender(
      <WidgetShell
        title="NAV vs Nifty 50"
        status="ready"
        footer="footer"
        collapsed
        onToggleCollapse={onToggleCollapse}
        summary="Live"
      >
        <p>Chart body</p>
      </WidgetShell>,
    );
    expect(screen.getByRole('button', { name: 'Expand NAV vs Nifty 50' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Chart body')).toBeNull();
    expect(screen.queryByText('footer')).toBeNull();
    // The live summary keeps announcing while collapsed.
    expect(screen.getByText('Live')).toBeInTheDocument();
  });
});

describe('LoadingSkeleton', () => {
  it.each<SkeletonShape>(['text', 'chart', 'table', 'widget'])(
    'renders the %s shape with shimmer blocks, hidden from assistive technology',
    (shape) => {
      renderWithProviders(<LoadingSkeleton shape={shape} />);
      const skeleton = screen.getByTestId(`loading-skeleton-${shape}`);
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
      expect(skeleton.querySelectorAll('.skeleton').length).toBeGreaterThan(1);
    },
  );

  it('draws the requested number of text lines', () => {
    renderWithProviders(<LoadingSkeleton shape="text" rows={5} />);
    expect(screen.getByTestId('loading-skeleton-text').querySelectorAll('.skeleton')).toHaveLength(
      5,
    );
  });
});

describe('collapsing a widget on the grid', () => {
  const initial = {
    dashboard: useDashboardStore.getState(),
    widgets: useWidgetStore.getState(),
  };
  beforeEach(() => {
    useDashboardStore.setState(initial.dashboard, true);
    useWidgetStore.setState(initial.widgets, true);
  });

  const page = 'workstation' as const;
  const id = 'workstation-nav-performance';
  const desktop = () => useDashboardStore.getState().pages[page].layouts.desktop ?? [];
  const item = (i: string) => desktop().find((l) => l.i === i);

  it('shrinks to the header, moves widgets below up, and restores the height on expand', () => {
    // Sector heatmap (x0 y11 6x5) has Drawdown directly and only beneath it.
    const heatmap = 'workstation-sector-heatmap';
    const drawdown = 'workstation-drawdown';
    const before = { heatmap: item(heatmap), drawdown: item(drawdown) };

    expect(setWidgetCollapsed(page, heatmap, true)).toBe(true);
    expect(item(heatmap)?.h).toBe(COLLAPSED_ROWS);
    expect(useWidgetStore.getState().instances[heatmap]?.collapsed?.desktop).toBe(
      before.heatmap?.h,
    );
    expect(item(drawdown)?.y).toBe((before.heatmap?.y ?? 0) + COLLAPSED_ROWS);
    // Collapsing twice is a no-op.
    expect(setWidgetCollapsed(page, heatmap, true)).toBe(false);

    expect(setWidgetCollapsed(page, heatmap, false)).toBe(true);
    expect(item(heatmap)?.h).toBe(before.heatmap?.h);
    expect(useWidgetStore.getState().instances[heatmap]?.collapsed).toBeUndefined();
    expect(item(drawdown)?.y).toBe(before.drawdown?.y);
  });

  it('is undoable', () => {
    const h = item(id)?.h;
    setWidgetCollapsed(page, id, true);
    expect(undoLayoutChange()?.label).toBe('Collapse widget');
    expect(item(id)?.h).toBe(h);
    expect(useWidgetStore.getState().instances[id]?.collapsed).toBeUndefined();
  });
});

describe('header badge from a widget definition', () => {
  it('counts the alerts that match the Alerts widget filters', () => {
    const alerts = widgetRegistry.getWidget('alerts-monitor');
    const data = fixture('alerts/active');
    const critical = { minSeverity: 'critical', type: 'all', showAcknowledged: true };
    expect(alerts?.badge(data, {})).toBe(data.alerts.length);
    expect(alerts?.badge(data, critical)).toBe(
      filterAlerts(data.alerts, { ...critical, minSeverity: 'critical', type: 'all' }).length,
    );
    // Widgets without a badge show none.
    expect(widgetRegistry.getWidget('var-gauge')?.badge(fixture('risk/var'), {})).toBeNull();
  });
});
