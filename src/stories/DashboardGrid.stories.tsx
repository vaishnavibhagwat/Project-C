import type { Meta, StoryObj } from '@storybook/react';
import { DashboardGrid } from '@/grid/DashboardGrid';
import { fixtureFetcher, WithFetcher } from './helpers';

const meta = {
  title: 'Grid/DashboardGrid',
  component: DashboardGrid,
  parameters: { layout: 'fullscreen' },
  args: { page: 'workstation' },
  decorators: [
    (Story) => (
      <WithFetcher fetcher={fixtureFetcher}>
        <div className="p-3">{Story()}</div>
      </WithFetcher>
    ),
  ],
} satisfies Meta<typeof DashboardGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default 10-widget workstation. Drag by the header, resize from the corner. */
export const Workstation: Story = {};
export const RiskAnalytics: Story = { args: { page: 'risk' } };
