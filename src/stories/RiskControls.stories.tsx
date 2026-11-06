import type { Meta, StoryObj } from '@storybook/react';
import { RiskControls } from '@/layout/RiskControls';

/** The Risk Analytics page header: VaR confidence and horizon for the page, and assumptions. */
const meta = {
  title: 'Layout/RiskControls',
  component: RiskControls,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RiskControls>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: 99%, 1 day. Open "Assumptions" to read the page's assumptions. */
export const Default: Story = {};
