import type { Meta, StoryObj } from '@storybook/react';
import { NavRail } from '@/layout/NavRail';

const meta = {
  title: 'Layout/NavRail',
  component: NavRail,
  args: { active: 'workstation' },
  render: (args) => (
    <div className="flex h-[420px]">
      <NavRail {...args} />
    </div>
  ),
} satisfies Meta<typeof NavRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Workstation: Story = {};
export const RiskActive: Story = { args: { active: 'risk' } };
