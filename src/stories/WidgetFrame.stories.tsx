import type { Meta, StoryObj } from '@storybook/react';
import { WidgetFrame } from '@/grid/WidgetFrame';
import {
  emptyHoldingsFetcher,
  failingFetcher,
  fixtureFetcher,
  pendingFetcher,
  SeedQuery,
  SimulatedOutage,
  WithFetcher,
} from './helpers';

const meta = {
  title: 'Grid/WidgetFrame',
  component: WidgetFrame,
  parameters: {
    docs: {
      description: {
        component:
          'Frame around every widget: header (title, info, last-updated, refresh, configure, duplicate, remove) and every data state.',
      },
    },
  },
  args: { page: 'workstation', instanceId: 'workstation-nav-performance' },
  render: (args) => (
    <div style={{ width: 720, height: 360 }}>
      <WidgetFrame {...args} />
    </div>
  ),
} satisfies Meta<typeof WidgetFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  decorators: [(Story) => <WithFetcher fetcher={fixtureFetcher}>{Story()}</WithFetcher>],
};

/** Shimmer skeleton shaped like the widget. */
export const Loading: Story = {
  decorators: [(Story) => <WithFetcher fetcher={pendingFetcher}>{Story()}</WithFetcher>],
};

export const Failed: Story = {
  decorators: [(Story) => <WithFetcher fetcher={failingFetcher}>{Story()}</WithFetcher>],
};

export const Empty: Story = {
  args: { instanceId: 'workstation-holdings-table' },
  decorators: [(Story) => <WithFetcher fetcher={emptyHoldingsFetcher}>{Story()}</WithFetcher>],
};

/** Data older than 2x the refresh interval: amber border and a "Stale" timestamp. */
export const Stale: Story = {
  decorators: [
    (Story) => (
      <WithFetcher fetcher={pendingFetcher}>
        <SeedQuery endpoint="portfolio/nav-history" ageMs={10 * 60_000}>
          {Story()}
        </SeedQuery>
      </WithFetcher>
    ),
  ],
};

export const Disconnected: Story = {
  decorators: [
    (Story) => (
      <WithFetcher fetcher={pendingFetcher}>
        <SimulatedOutage>{Story()}</SimulatedOutage>
      </WithFetcher>
    ),
  ],
};

export const DisconnectedWithLastData: Story = {
  decorators: [
    (Story) => (
      <WithFetcher fetcher={pendingFetcher}>
        <SeedQuery endpoint="portfolio/nav-history" ageMs={30_000}>
          <SimulatedOutage>{Story()}</SimulatedOutage>
        </SeedQuery>
      </WithFetcher>
    ),
  ],
};
