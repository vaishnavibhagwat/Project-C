import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { selectSeries } from '@/widgets/correlation-matrix/model';
import { ScatterModal } from '@/widgets/correlation-matrix/ScatterModal';
import { fixtureData } from '@/widgets/correlation-matrix/__tests__';

const data = fixtureData();
const holdings = selectSeries(data, { subject: 'holdings', count: '15', lookback: '90' });
const sectors = selectSeries(data, { subject: 'sectors', count: '15', lookback: '252' });

const meta = {
  title: 'Widgets/Parts/ScatterModal',
  component: ScatterModal,
  parameters: { layout: 'fullscreen' },
  args: {
    a: holdings.series[2] ?? data.holdings[0],
    b: holdings.series[3] ?? data.holdings[1],
    dates: holdings.dates,
    onClose: fn(),
  },
} satisfies Meta<typeof ScatterModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two stocks over 90 days. */
export const Default: Story = {};

/** Two sectors over a year. */
export const Configured: Story = {
  args: {
    a: sectors.series[0] ?? data.sectors[0],
    b: sectors.series[1] ?? data.sectors[1],
    dates: sectors.dates,
  },
};
