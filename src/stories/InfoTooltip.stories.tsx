import type { Meta, StoryObj } from '@storybook/react';
import { InfoTooltip } from '@/components/Tooltip';

const meta = {
  title: 'Components/InfoTooltip',
  component: InfoTooltip,
  args: {
    label: 'About Sharpe ratio',
    content:
      '(Annualised mean daily return − risk-free 6.75%) ÷ annualised volatility. 252-day year.',
  },
} satisfies Meta<typeof InfoTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const RichContent: Story = {
  args: {
    content: (
      <ul className="list-disc pl-4">
        <li>Horizon: 1 trading day</li>
        <li>Lookback: 252 sessions</li>
      </ul>
    ),
  },
};
