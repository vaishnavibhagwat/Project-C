import type { Meta, StoryObj } from '@storybook/react';
import { Gauge } from '@/widgets/var-gauge/Gauge';

const meta = {
  title: 'Widgets/Parts/Gauge',
  component: Gauge,
  args: {
    value: 0.0166,
    limit: 0.02,
    status: 'near',
    size: 240,
    label: '1.66%',
    sublabel: '₹6,252 Cr · 83% of limit',
  },
} satisfies Meta<typeof Gauge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NearLimit: Story = {};
export const Within: Story = {
  args: { value: 0.008, status: 'within', label: '0.80%', sublabel: '40% of limit' },
};
export const Breach: Story = {
  args: { value: 0.031, status: 'breach', label: '3.10%', sublabel: '155% of limit' },
};
