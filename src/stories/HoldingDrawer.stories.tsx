import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { HoldingDrawer } from '@/widgets/holdings-table/HoldingDrawer';
import { fixtureData } from '@/widgets/holdings-table/__tests__';

const holdings = fixtureData().holdings;

const meta = {
  title: 'Widgets/Parts/HoldingDrawer',
  component: HoldingDrawer,
  parameters: { layout: 'fullscreen' },
  args: { holding: holdings[0] ?? null, onClose: fn() },
} satisfies Meta<typeof HoldingDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The largest stock position: sparkline, position, P&L and related news. */
export const Default: Story = {};

/** A bond: no sector, priced per 100 face. */
export const Configured: Story = {
  args: { holding: holdings.find((h) => h.assetClass === 'Fixed Income') ?? null },
};
