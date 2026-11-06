import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { stressScenariosDefinition } from '@/widgets/stress-scenarios/config';
import StressScenarios from '@/widgets/stress-scenarios/index';
import { configuredConfig, fixtureData } from '@/widgets/stress-scenarios/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Stress Scenarios',
  component: StressScenarios,
  parameters: { docs: { description: { component: stressScenariosDefinition.description } } },
  args: {
    instanceId: 'story-stress-scenarios',
    config: stressScenariosDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 560,
    height: 300,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <StressScenarios {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof StressScenarios>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
