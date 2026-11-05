import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { marketTickerDefinition } from '@/widgets/market-ticker/config';
import MarketTicker from '@/widgets/market-ticker/index';
import { configuredConfig, fixtureData } from '@/widgets/market-ticker/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Market Ticker',
  component: MarketTicker,
  parameters: { docs: { description: { component: marketTickerDefinition.description } } },
  args: {
    instanceId: 'story-market-ticker',
    config: marketTickerDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 720,
    height: 32,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <MarketTicker {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof MarketTicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
