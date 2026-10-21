import type { Meta, StoryObj } from '@storybook/react';
import { alertsMonitorDefinition } from '@/widgets/alerts-monitor/config';
import AlertsMonitor from '@/widgets/alerts-monitor/index';
import { configuredConfig, fixtureData } from '@/widgets/alerts-monitor/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Alerts Monitor',
  component: AlertsMonitor,
  parameters: { docs: { description: { component: alertsMonitorDefinition.description } } },
  args: {
    instanceId: 'story-alerts-monitor',
    config: alertsMonitorDefinition.defaultConfig,
    data: fixtureData(),
    width: 420,
    height: 380,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <AlertsMonitor {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof AlertsMonitor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
