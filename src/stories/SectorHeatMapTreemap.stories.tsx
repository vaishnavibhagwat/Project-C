import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { sectorHeatMapDefinition } from '@/widgets/sector-heat-map/config';
import SectorHeatMap from '@/widgets/sector-heat-map/index';
import { configuredConfig, fixtureData } from '@/widgets/sector-heat-map/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Sector Heat Map',
  component: SectorHeatMap,
  parameters: { docs: { description: { component: sectorHeatMapDefinition.description } } },
  args: {
    instanceId: 'story-sector-heat-map',
    config: sectorHeatMapDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 420,
    height: 260,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <SectorHeatMap {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof SectorHeatMap>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
