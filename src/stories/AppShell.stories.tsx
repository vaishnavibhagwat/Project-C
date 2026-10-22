import type { Meta, StoryObj } from '@storybook/react';
import { AppRoutes } from '@/layout/AppRoutes';
import { AppShell } from '@/layout/AppShell';

const meta = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen', route: '/workstation' },
  render: () => (
    <div style={{ height: 900 }}>
      <AppRoutes />
    </div>
  ),
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full workstation running against the simulated mock API. */
export const Workstation: Story = {};

/** The Settings page (grid, appearance, data feed, workspace, shortcuts). */
export const Settings: Story = { parameters: { route: '/settings' } };
