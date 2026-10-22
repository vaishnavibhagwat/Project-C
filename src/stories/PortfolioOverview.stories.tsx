import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { portfolioOverviewDefinition } from '@/widgets/portfolio-overview/config';
import PortfolioOverview from '@/widgets/portfolio-overview/index';
import { configuredConfig, fixtureData } from '@/widgets/portfolio-overview/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Portfolio Overview',
  component: PortfolioOverview,
  parameters: { docs: { description: { component: portfolioOverviewDefinition.description } } },
  args: {
    instanceId: 'story-portfolio-overview',
    config: portfolioOverviewDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 1200,
    height: 110,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <PortfolioOverview {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof PortfolioOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
