import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { topMoversDefinition } from '@/registry/plugins/demo-top-movers/config';
import TopMovers from '@/registry/plugins/demo-top-movers/TopMovers';
import { configuredConfig, fixtureData } from '@/registry/plugins/demo-top-movers/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Top Movers (demo plugin)',
  component: TopMovers,
  parameters: { docs: { description: { component: topMoversDefinition.description } } },
  args: {
    instanceId: 'story-top-movers',
    config: topMoversDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 520,
    height: 260,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <TopMovers {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof TopMovers>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** Three rows per list, ranked by rupee P&L. */
export const Configured: Story = { args: { config: configuredConfig } };
