import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetMarketplace } from '@/layout/WidgetMarketplace';
import { isPluginActive, uninstallPlugin } from '@/registry/pluginHost';
import { widgetRegistry } from '@/registry/registry';
import { useDashboardStore } from '@/store/dashboardStore';
import { useWidgetStore } from '@/store/widgetStore';
import { renderWithProviders } from './render';

const initialDashboard = useDashboardStore.getState();
const initialWidgets = useWidgetStore.getState();

describe('Widget Marketplace', () => {
  afterEach(() => {
    if (isPluginActive('demo-top-movers')) uninstallPlugin('demo-top-movers');
    useDashboardStore.setState(initialDashboard, true);
    useWidgetStore.setState(initialWidgets, true);
  });

  const cards = () => within(screen.getByRole('list', { name: 'Widgets' })).getAllByRole('heading');

  it('shows a card with a preview thumbnail, category and description per widget', () => {
    renderWithProviders(<WidgetMarketplace initialTarget="research" onOpenPage={vi.fn()} />);
    expect(cards()).toHaveLength(widgetRegistry.size);
    expect(document.querySelectorAll('[data-testid^="preview-"]')).toHaveLength(
      widgetRegistry.size,
    );
    expect(screen.getByText(/Every widget loads on demand/)).toBeInTheDocument();
  });

  it('installs the demo plugin without a reload, adds its widget, then uninstalls it', async () => {
    const builtIn = widgetRegistry.size;
    renderWithProviders(<WidgetMarketplace initialTarget="research" onOpenPage={vi.fn()} />);
    const plugins = screen.getByRole('region', { name: 'Plugins' });
    expect(within(plugins).getByText('Available')).toBeInTheDocument();

    fireEvent.click(within(plugins).getByRole('button', { name: 'Install plugin' }));
    await waitFor(() => expect(cards()).toHaveLength(builtIn + 1));
    expect(within(plugins).getByText('Installed')).toBeInTheDocument();
    expect(await screen.findByText(/Installed Top Movers/)).toBeInTheDocument();
    expect(useDashboardStore.getState().installedPlugins).toContain('demo-top-movers');

    const card = screen.getByText('Top Movers', { selector: 'h2' }).closest('li');
    if (!card) throw new Error('no Top Movers card');
    expect(within(card).getByText('Plugin')).toBeInTheDocument();
    const before = useDashboardStore.getState().pages.research.itemIds.length;
    fireEvent.click(within(card).getByRole('button', { name: /^Add to/ }));
    expect(useDashboardStore.getState().pages.research.itemIds).toHaveLength(before + 1);

    fireEvent.click(within(plugins).getByRole('button', { name: 'Uninstall' }));
    await waitFor(() => expect(cards()).toHaveLength(builtIn));
    expect(useDashboardStore.getState().pages.research.itemIds).toHaveLength(before);
    expect(useDashboardStore.getState().installedPlugins).not.toContain('demo-top-movers');
  });
});
