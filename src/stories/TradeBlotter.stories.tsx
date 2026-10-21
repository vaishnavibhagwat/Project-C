import type { Meta, StoryObj } from '@storybook/react';
import { tradeBlotterDefinition } from '@/widgets/trade-blotter/config';
import TradeBlotter from '@/widgets/trade-blotter/index';
import { configuredConfig, fixtureData } from '@/widgets/trade-blotter/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Trade Blotter',
  component: TradeBlotter,
  parameters: { docs: { description: { component: tradeBlotterDefinition.description } } },
  args: {
    instanceId: 'story-trade-blotter',
    config: tradeBlotterDefinition.defaultConfig,
    data: fixtureData(),
    width: 960,
    height: 360,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <TradeBlotter {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof TradeBlotter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
