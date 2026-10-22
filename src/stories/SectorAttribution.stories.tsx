import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { sectorAttributionDefinition } from '@/widgets/sector-attribution/config';
import SectorAttribution from '@/widgets/sector-attribution/index';
import { configuredConfig, fixtureData } from '@/widgets/sector-attribution/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Sector Attribution',
  component: SectorAttribution,
  parameters: { docs: { description: { component: sectorAttributionDefinition.description } } },
  args: {
    instanceId: 'story-sector-attribution',
    config: sectorAttributionDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 1200,
    height: 400,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <SectorAttribution {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof SectorAttribution>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
