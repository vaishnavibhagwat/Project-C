import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { navPerformanceDefinition } from '@/widgets/nav-performance/config';
import NavPerformance from '@/widgets/nav-performance/index';
import { configuredConfig, fixtureData } from '@/widgets/nav-performance/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/NAV vs Nifty 50',
  component: NavPerformance,
  parameters: { docs: { description: { component: navPerformanceDefinition.description } } },
  args: {
    instanceId: 'story-nav-performance',
    config: navPerformanceDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 720,
    height: 340,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <NavPerformance {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof NavPerformance>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
