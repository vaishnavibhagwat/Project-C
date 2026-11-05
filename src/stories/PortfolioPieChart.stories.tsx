import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { portfolioPieChartDefinition } from '@/widgets/portfolio-pie-chart/config';
import PortfolioPieChart from '@/widgets/portfolio-pie-chart/index';
import { configuredConfig, fixtureData } from '@/widgets/portfolio-pie-chart/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Portfolio Pie Chart',
  component: PortfolioPieChart,
  parameters: { docs: { description: { component: portfolioPieChartDefinition.description } } },
  args: {
    instanceId: 'story-portfolio-pie-chart',
    config: portfolioPieChartDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 420,
    height: 220,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <PortfolioPieChart {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof PortfolioPieChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
