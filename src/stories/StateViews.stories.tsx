import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { DisconnectedState, EmptyState, ErrorState } from '@/components/StateViews';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Components/StateViews',
  component: ErrorState,
  args: { message: 'GET /api/risk/var returned 503 (simulated upstream failure)', onRetry: fn() },
  render: (args) => (
    <WidgetCanvas width={360} height={200}>
      <ErrorState {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Failed: Story = {};
export const Retrying: Story = { args: { retrying: true } };
export const Empty: Story = {
  render: () => (
    <WidgetCanvas width={360} height={200}>
      <EmptyState message="The data source returned no rows for this widget." />
    </WidgetCanvas>
  ),
};
export const Disconnected: Story = {
  render: () => (
    <WidgetCanvas width={360} height={200}>
      <DisconnectedState since="11:42 IST" onReconnect={fn()} />
    </WidgetCanvas>
  ),
};
