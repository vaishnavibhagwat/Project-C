import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { SymbolDetail } from '@/layout/SymbolDetail';
import { fixtureFetcher, WithFetcher } from './helpers';

const meta = {
  title: 'Layout/SymbolDetail',
  component: SymbolDetail,
  args: { symbol: 'RELIANCE', onClose: fn() },
  decorators: [(Story) => <WithFetcher fetcher={fixtureFetcher}>{Story()}</WithFetcher>],
} satisfies Meta<typeof SymbolDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A held position: 1Y simulated closes plus quantity, cost and P&L. */
export const Held: Story = {};

/** A Nifty 50 constituent the fund does not hold. */
export const NotHeld: Story = { args: { symbol: 'NOT-HELD' } };
