import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { sectorHeatmapDefinition } from '@/widgets/sector-heatmap/config';
import SectorHeatmap from '@/widgets/sector-heatmap/index';
import { configuredConfig, fixtureData } from '@/widgets/sector-heatmap/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Sector Heat Map',
  component: SectorHeatmap,
  parameters: { docs: { description: { component: sectorHeatmapDefinition.description } } },
  args: {
    instanceId: 'story-sector-heatmap',
    config: sectorHeatmapDefinition.defaultConfig,
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
      <SectorHeatmap {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof SectorHeatmap>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
