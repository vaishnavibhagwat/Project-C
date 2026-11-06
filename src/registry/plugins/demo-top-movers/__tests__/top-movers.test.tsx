import { screen, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderWithProviders, widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { installPlugin, isPluginActive, uninstallPlugin } from '@/registry/pluginHost';
import { widgetRegistry } from '@/registry/registry';
import { addWidgetToPage } from '@/store/actions';
import { useDashboardStore } from '@/store/dashboardStore';
import { plugin, topMoversDefinition, TOP_MOVERS_WIDGET_ID } from '../index';
import { summarizeMovers, topMovers } from '../model';
import TopMovers from '../TopMovers';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = topMoversDefinition.defaultConfig;

describe('Top Movers model', () => {
  it('ranks gainers and losers by % move, at most `count` each, without flat rows', () => {
    const { gainers, losers } = topMovers(data, defaults);
    expect(gainers.length).toBeLessThanOrEqual(5);
    expect(losers.length).toBeLessThanOrEqual(5);
    expect(gainers.every((m) => m.dailyPnLPercent > 0)).toBe(true);
    expect(losers.every((m) => m.dailyPnLPercent < 0)).toBe(true);
    const best = Math.max(...data.holdings.map((h) => h.dailyPnLPercent));
    expect(gainers[0]?.dailyPnLPercent).toBe(best);
    const worst = Math.min(...data.holdings.map((h) => h.dailyPnLPercent));
    expect(losers[0]?.dailyPnLPercent).toBe(worst);
  });

  it('ranks by rupee P&L when configured', () => {
    const { gainers } = topMovers(data, configuredConfig);
    expect(gainers.length).toBeLessThanOrEqual(3);
    expect(gainers[0]?.dailyPnL).toBe(Math.max(...data.holdings.map((h) => h.dailyPnL)));
    expect(summarizeMovers(data, configuredConfig)).toMatch(
      /^Top movers today: best .+, worst .+\./,
    );
  });
});

describe('TopMovers', () => {
  it('lists gainers and losers with text values, not only bars', () => {
    renderWithProviders(<TopMovers {...widgetProps(defaults, data, 600, 300)} />);
    const gainers = screen.getByRole('region', { name: 'Gainers' });
    const { gainers: expected } = topMovers(data, defaults);
    expect(within(gainers).getAllByRole('listitem')).toHaveLength(expected.length);
    expect(within(gainers).getByText(expected[0]?.ticker ?? '?')).toBeInTheDocument();
    expect(screen.getByText(/Demo plugin · registered at runtime/)).toBeInTheDocument();
  });
});

describe('plugin install', () => {
  // Start uninstalled (the frame-state tests below register it at load time).
  beforeAll(() => plugin.uninstall(widgetRegistry));
  afterAll(() => {
    if (!widgetRegistry.hasWidget(TOP_MOVERS_WIDGET_ID)) plugin.install(widgetRegistry);
  });

  it('registers through the registry API, is remembered, and uninstalls cleanly', async () => {
    const before = widgetRegistry.getVersion();
    expect(await installPlugin('demo-top-movers')).toBe(true);
    expect(isPluginActive('demo-top-movers')).toBe(true);
    expect(widgetRegistry.getVersion()).toBeGreaterThan(before);
    expect(widgetRegistry.getWidget(TOP_MOVERS_WIDGET_ID)?.name).toBe('Top Movers');
    expect(useDashboardStore.getState().installedPlugins).toEqual(['demo-top-movers']);

    // Installing twice is a no-op, not a duplicate-id error.
    expect(await installPlugin('demo-top-movers')).toBe(true);
    expect(await installPlugin('no-such-plugin')).toBe(false);

    const instanceId = addWidgetToPage('research', TOP_MOVERS_WIDGET_ID);
    expect(instanceId).not.toBeNull();
    expect(uninstallPlugin('demo-top-movers')).toBe(1);
    expect(useDashboardStore.getState().pages.research.itemIds).not.toContain(instanceId);
    expect(widgetRegistry.hasWidget(TOP_MOVERS_WIDGET_ID)).toBe(false);
    expect(useDashboardStore.getState().installedPlugins).toEqual([]);
  });
});

// The frame-level states need the widget registered, as after an install.
if (!widgetRegistry.hasWidget(TOP_MOVERS_WIDGET_ID)) plugin.install(widgetRegistry);
describeWidgetStates(TOP_MOVERS_WIDGET_ID, { data: fixtureData, emptyData });
