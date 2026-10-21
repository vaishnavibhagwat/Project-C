import type { Meta, StoryObj } from '@storybook/react';
import { IconButton } from '@/components/Button';
import { IconRefresh, IconSettings } from '@/components/Icons';

const meta = {
  title: 'Components/IconButton',
  component: IconButton,
  args: { label: 'Refresh', icon: IconRefresh, size: 'sm' },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Active: Story = { args: { label: 'Configure', icon: IconSettings, active: true } };
