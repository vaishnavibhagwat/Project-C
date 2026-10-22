import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { holdingsTableDefinition } from '@/widgets/holdings-table/config';
import HoldingsTable from '@/widgets/holdings-table/index';
import { configuredConfig, fixtureData } from '@/widgets/holdings-table/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Holdings Table',
  component: HoldingsTable,
  parameters: { docs: { description: { component: holdingsTableDefinition.description } } },
  args: {
    instanceId: 'story-holdings-table',
    config: holdingsTableDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 960,
    height: 400,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <HoldingsTable {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof HoldingsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
