import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { holdingsTreemapDefinition } from '@/widgets/holdings-treemap/config';
import HoldingsTreemap from '@/widgets/holdings-treemap/index';
import { configuredConfig, fixtureData } from '@/widgets/holdings-treemap/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Holdings Treemap',
  component: HoldingsTreemap,
  parameters: { docs: { description: { component: holdingsTreemapDefinition.description } } },
  args: {
    instanceId: 'story-holdings-treemap',
    config: holdingsTreemapDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 720,
    height: 360,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <HoldingsTreemap {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof HoldingsTreemap>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
