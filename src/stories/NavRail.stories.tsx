import type { Meta, StoryObj } from '@storybook/react';
import { NavRail } from '@/layout/NavRail';

const meta = {
  title: 'Layout/NavRail',
  component: NavRail,
  render: () => (
    <div className="flex h-[480px]">
      <NavRail />
    </div>
  ),
} satisfies Meta<typeof NavRail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Seven destinations; hover or focus an icon for its tooltip. */
export const Workstation: Story = {};
export const RiskActive: Story = { parameters: { route: '/risk' } };
export const SettingsActive: Story = { parameters: { route: '/settings' } };
