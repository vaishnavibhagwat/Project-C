import type { Meta, StoryObj } from '@storybook/react';
import { Gauge } from '@/widgets/var-gauge/Gauge';

/** Limit 2% of AUM; the scale runs to 125% of the limit (2.5%). */
const meta = {
  title: 'Widgets/Parts/Gauge',
  component: Gauge,
  args: {
    value: 0.0166,
    limit: 0.02,
    max: 0.025,
    range: { min: 0.0141, max: 0.0172 },
    size: 240,
  },
} satisfies Meta<typeof Gauge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 83% of the limit: amber zone. */
export const NearLimit: Story = {};
/** 40% of the limit: green zone. */
export const Within: Story = { args: { value: 0.008, range: { min: 0.007, max: 0.0095 } } };
/** Past the limit: the scale stretches so the needle stays on the dial. */
export const Breach: Story = {
  args: { value: 0.031, max: 0.0341, range: { min: 0.024, max: 0.031 } },
};
