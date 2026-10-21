import type { Meta, StoryObj } from '@storybook/react';
import { riskMetricsDefinition } from '@/widgets/risk-metrics/config';
import RiskMetrics from '@/widgets/risk-metrics/index';
import { configuredConfig, fixtureData } from '@/widgets/risk-metrics/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Risk Metrics',
  component: RiskMetrics,
  parameters: { docs: { description: { component: riskMetricsDefinition.description } } },
  args: {
    instanceId: 'story-risk-metrics',
    config: riskMetricsDefinition.defaultConfig,
    data: fixtureData(),
    width: 1000,
    height: 170,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <RiskMetrics {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof RiskMetrics>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
