import type { Meta, StoryObj } from '@storybook/react';
import { assetAllocationDefinition } from '@/widgets/asset-allocation/config';
import AssetAllocation from '@/widgets/asset-allocation/index';
import { configuredConfig, fixtureData } from '@/widgets/asset-allocation/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Asset Allocation',
  component: AssetAllocation,
  parameters: { docs: { description: { component: assetAllocationDefinition.description } } },
  args: {
    instanceId: 'story-asset-allocation',
    config: assetAllocationDefinition.defaultConfig,
    data: fixtureData(),
    width: 380,
    height: 360,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <AssetAllocation {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof AssetAllocation>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
