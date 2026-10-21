import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { WidgetMarketplace } from '@/layout/WidgetMarketplace';

const meta = {
  title: 'Layout/WidgetMarketplace',
  component: WidgetMarketplace,
  args: { initialTarget: 'workstation', onOpenPage: fn() },
} satisfies Meta<typeof WidgetMarketplace>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every registered widget, filterable by category, addable to any page. */
export const Default: Story = {};
export const TargetingRisk: Story = { args: { initialTarget: 'risk' } };
