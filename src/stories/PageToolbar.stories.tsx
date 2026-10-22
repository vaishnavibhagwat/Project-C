import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { getPageMeta } from '@/registry/pages';
import { PageToolbar } from '@/layout/PageToolbar';

const meta = {
  title: 'Layout/PageToolbar',
  component: PageToolbar,
  args: {
    page: getPageMeta('workstation'),
    onOpenMarketplace: fn(),
    onOpenLayouts: fn(),
    onShare: fn(),
    onReset: fn(),
  },
} satisfies Meta<typeof PageToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Workstation: Story = {};
export const Performance: Story = { args: { page: getPageMeta('performance') } };
