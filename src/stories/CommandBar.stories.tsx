import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { CommandBar } from '@/layout/CommandBar';
import { FeedControl } from '@/layout/FeedControl';
import { MarketStatus } from '@/layout/MarketStatus';
import { Notifications } from '@/layout/Notifications';
import { UserMenu } from '@/layout/UserMenu';
import { WorkspaceSelector } from '@/layout/WorkspaceSelector';
import { fixtureFetcher, WithFetcher } from './helpers';

const meta = {
  title: 'Layout/CommandBar',
  component: CommandBar,
  parameters: { layout: 'fullscreen' },
  args: { page: 'workstation', onOpenSearch: fn(), onOpenLayouts: fn() },
  decorators: [(Story) => <WithFetcher fetcher={fixtureFetcher}>{Story()}</WithFetcher>],
} satisfies Meta<typeof CommandBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Wordmark, dashboard selector, search, NSE status pill, last refresh, SIMULATED DATA label,
 * theme, notifications and profile.
 */
export const Default: Story = {};

/** The individual command-bar controls. Each opens its own menu. */
export const Controls: Story = {
  render: () => (
    <div className="flex items-center gap-4 p-4 pb-72">
      <WorkspaceSelector page="workstation" onManageLayouts={() => undefined} />
      <MarketStatus />
      <FeedControl />
      <Notifications />
      <UserMenu />
    </div>
  ),
};
