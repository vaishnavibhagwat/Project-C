import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { exposureBreakdownDefinition } from '@/widgets/exposure-breakdown/config';
import ExposureBreakdown from '@/widgets/exposure-breakdown/index';
import { configuredConfig, fixtureData } from '@/widgets/exposure-breakdown/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Exposure Breakdown',
  component: ExposureBreakdown,
  parameters: { docs: { description: { component: exposureBreakdownDefinition.description } } },
  args: {
    instanceId: 'story-exposure-breakdown',
    config: exposureBreakdownDefinition.defaultConfig,
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
      <ExposureBreakdown {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof ExposureBreakdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
