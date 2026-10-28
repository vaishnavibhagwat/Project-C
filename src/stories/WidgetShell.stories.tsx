import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { IconButton } from '@/components/Button';
import { IconRefresh } from '@/components/Icons';
import { WidgetShell } from '@/components/WidgetShell';

const meta = {
  title: 'Components/WidgetShell',
  component: WidgetShell,
  args: {
    title: 'NAV vs Nifty 50',
    status: 'ready',
    lastUpdated: '14:32:05 IST',
    summary: 'Fund up 20.1% over 1 year, Nifty 50 up 14.0%.',
    children: (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        Body slot (simulated chart)
      </div>
    ),
  },
  render: (args) => (
    <div style={{ width: 460, height: 260 }}>
      <WidgetShell {...args} />
    </div>
  ),
} satisfies Meta<typeof WidgetShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Title, last-updated time and the body slot; no optional controls. */
export const Default: Story = {};

/** Everything switched on: drag grip, badge, settings, collapse, remove, extra action, footer. */
export const Configured: Story = {
  args: {
    title: 'Alerts',
    badgeCount: 7,
    draggable: true,
    onSettings: fn(),
    onToggleCollapse: fn(),
    onRemove: fn(),
    actions: <IconButton label="Refresh" icon={IconRefresh} size="xs" />,
    footer: 'Rule-based alerts · simulated data',
  },
};

export const Loading: Story = { args: { status: 'loading', lastUpdated: null } };

export const ErrorWithRetry: Story = {
  args: {
    status: 'error',
    errorMessage: 'GET /api/v1/portfolio/nav timed out after 8 s.',
    onRetry: fn(),
  },
};

export const Empty: Story = {
  args: { status: 'empty', emptyMessage: 'No trades booked today.' },
};

/** Data older than 2× the refresh interval: amber border and Stale badge. */
export const Stale: Story = {
  args: { stale: true, staleReason: 'Data is older than 2× the 15s refresh interval' },
};

export const Disconnected: Story = {
  args: { status: 'disconnected', disconnectedSince: '14:02', onReconnect: fn() },
};

export const Collapsed: Story = {
  args: { collapsed: true, onToggleCollapse: fn(), draggable: true },
};
