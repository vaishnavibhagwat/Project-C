import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { alertPanelDefinition } from '@/widgets/alert-panel/config';
import AlertPanel from '@/widgets/alert-panel/index';
import { configuredConfig, fixtureData } from '@/widgets/alert-panel/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Alert Panel',
  component: AlertPanel,
  parameters: { docs: { description: { component: alertPanelDefinition.description } } },
  args: {
    instanceId: 'story-alert-panel',
    config: alertPanelDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 360,
    height: 300,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <AlertPanel {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof AlertPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
