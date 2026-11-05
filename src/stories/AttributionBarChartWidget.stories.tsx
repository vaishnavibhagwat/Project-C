import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { attributionBarChartDefinition } from '@/widgets/attribution-bar-chart/config';
import AttributionBarChart from '@/widgets/attribution-bar-chart/index';
import { configuredConfig, fixtureData } from '@/widgets/attribution-bar-chart/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Attribution Bars',
  component: AttributionBarChart,
  parameters: { docs: { description: { component: attributionBarChartDefinition.description } } },
  args: {
    instanceId: 'story-attribution-bar-chart',
    config: attributionBarChartDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 640,
    height: 300,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <AttributionBarChart {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof AttributionBarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
