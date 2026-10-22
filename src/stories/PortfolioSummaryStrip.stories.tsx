import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { PortfolioSummaryStrip, PortfolioSummaryStripView } from '@/layout/PortfolioSummaryStrip';
import { PLACEHOLDER_SUMMARY_STRIP } from '@/layout/summaryStrip';
import { fixtureFetcher, WithFetcher } from './helpers';

const meta = {
  title: 'Layout/PortfolioSummaryStrip',
  component: PortfolioSummaryStripView,
  parameters: { layout: 'padded' },
  args: { data: PLACEHOLDER_SUMMARY_STRIP, onRetry: fn() },
} satisfies Meta<typeof PortfolioSummaryStripView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Placeholder values (illustrative, not from the dataset). Hover or focus ⓘ for each metric. */
export const Default: Story = {};

/** A losing day: P&L and MTD turn coral with ▼; volatility above its 12-month figure. */
export const DownDay: Story = {
  args: {
    data: {
      ...PLACEHOLDER_SUMMARY_STRIP,
      intradayChange: -0.0019,
      dailyPnlInr: -7_140_000_000,
      dailyPnlChange: -0.0019,
      mtdReturn: -0.012,
      volatility12m: 0.151,
    },
  },
};

/** VaR above the 2.0% hard limit shows coral ▲ "over limit". */
export const VarOverLimit: Story = {
  args: { data: { ...PLACEHOLDER_SUMMARY_STRIP, var99: 0.0231, var99Inr: 86_800_000_000 } },
};

/** Shaped shimmer skeleton while the first data loads. */
export const Loading: Story = { args: { data: undefined } };

export const LoadError: Story = {
  args: { data: undefined, error: new Error('GET /api/risk/var returned 503 (simulated)') },
};

export const Disconnected: Story = { args: { data: undefined, disconnected: true } };

/** Wired to the shared mock dataset through the same cached endpoints as the widgets. */
export const Live: Story = {
  render: () => (
    <WithFetcher fetcher={fixtureFetcher}>
      <PortfolioSummaryStrip />
    </WithFetcher>
  ),
};
