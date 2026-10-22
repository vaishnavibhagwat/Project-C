import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { GridToolbar } from '@/grid/GridToolbar';

const meta = {
  title: 'Grid/GridToolbar',
  component: GridToolbar,
  args: { page: 'research', onOpenMarketplace: fn() },
} satisfies Meta<typeof GridToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Add an empty slot at the next free position, open the marketplace, switch compaction. */
export const Default: Story = {};
