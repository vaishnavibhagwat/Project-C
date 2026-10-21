import type { Meta, StoryObj } from '@storybook/react';
import { Delta } from '@/components/Delta';

const meta = {
  title: 'Components/Delta',
  component: Delta,
  args: { value: 0.0123 },
} satisfies Meta<typeof Delta>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Positive: Story = {};
export const Negative: Story = { args: { value: -0.0087 } };
export const Flat: Story = { args: { value: 0 } };
export const CustomText: Story = { args: { value: 1, text: '+₹1,418 Cr', arrow: false } };
