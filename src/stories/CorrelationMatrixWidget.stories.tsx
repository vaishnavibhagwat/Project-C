import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { correlationMatrixDefinition } from '@/widgets/correlation-matrix/config';
import CorrelationMatrix from '@/widgets/correlation-matrix/index';
import { configuredConfig, fixtureData } from '@/widgets/correlation-matrix/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Correlation Matrix',
  component: CorrelationMatrix,
  parameters: { docs: { description: { component: correlationMatrixDefinition.description } } },
  args: {
    instanceId: 'story-correlation-matrix',
    config: correlationMatrixDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 460,
    height: 360,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <CorrelationMatrix {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof CorrelationMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
