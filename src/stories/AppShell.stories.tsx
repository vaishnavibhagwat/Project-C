import type { Meta, StoryObj } from '@storybook/react';
import { AppShell } from '@/layout/AppShell';

const meta = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div style={{ height: 900 }}>
      <AppShell />
    </div>
  ),
} satisfies Meta<typeof AppShell>;

export default meta;

/** The full workstation running against the simulated mock API. */
export const Workstation: StoryObj<typeof meta> = {};
