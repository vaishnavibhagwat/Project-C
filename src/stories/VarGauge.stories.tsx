import type { Meta, StoryObj } from '@storybook/react';
import { varGaugeDefinition } from '@/widgets/var-gauge/config';
import VarGauge from '@/widgets/var-gauge/index';
import { configuredConfig, fixtureData } from '@/widgets/var-gauge/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Value at Risk',
  component: VarGauge,
  parameters: { docs: { description: { component: varGaugeDefinition.description } } },
  args: {
    instanceId: 'story-var-gauge',
    config: varGaugeDefinition.defaultConfig,
    data: fixtureData(),
    width: 380,
    height: 420,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <VarGauge {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof VarGauge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
