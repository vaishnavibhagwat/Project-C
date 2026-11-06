import type { Meta, StoryObj } from '@storybook/react';
import { WidgetPreview } from '@/layout/WidgetPreview';

const meta = {
  title: 'Layout/WidgetPreview',
  component: WidgetPreview,
  args: { variant: 'line-chart' },
  render: (args) => (
    <div className="w-64">
      <WidgetPreview {...args} />
    </div>
  ),
} satisfies Meta<typeof WidgetPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Marketplace thumbnail for a line chart. */
export const Default: Story = {};
export const Heatmap: Story = { args: { variant: 'heatmap' } };
