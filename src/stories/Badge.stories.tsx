import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@/components/Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'Simulated data', tone: 'warning' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Tones: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge>Neutral</Badge>
      <Badge tone="accent">Info</Badge>
      <Badge tone="positive">Within limit</Badge>
      <Badge tone="warning">Warning</Badge>
      <Badge tone="negative">Critical</Badge>
    </div>
  ),
};
