import type { Meta, StoryObj } from '@storybook/react';
import { drawdownDefinition } from '@/widgets/drawdown/config';
import Drawdown from '@/widgets/drawdown/index';
import { configuredConfig, fixtureData } from '@/widgets/drawdown/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Drawdown',
  component: Drawdown,
  parameters: { docs: { description: { component: drawdownDefinition.description } } },
  args: {
    instanceId: 'story-drawdown',
    config: drawdownDefinition.defaultConfig,
    data: fixtureData(),
    width: 720,
    height: 300,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <Drawdown {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof Drawdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
