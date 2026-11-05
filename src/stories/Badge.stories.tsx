import type { Meta, StoryObj } from '@storybook/react';
import { Badge, SentimentBadge } from '@/components/Badge';

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

/** Sentiment badges: colour plus a mark and a text label, so colour is never the only cue. */
export const Sentiment: Story = {
  render: () => (
    <div className="flex gap-2">
      <SentimentBadge sentiment="positive" score={0.62} />
      <SentimentBadge sentiment="negative" score={-0.41} />
      <SentimentBadge sentiment="neutral" score={0.04} />
    </div>
  ),
};
