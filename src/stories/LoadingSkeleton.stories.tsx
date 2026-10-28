import type { Meta, StoryObj } from '@storybook/react';
import { LoadingSkeleton, type SkeletonShape } from '@/components/LoadingSkeleton';
import { WidgetCanvas } from './helpers';

const SHAPES: SkeletonShape[] = ['text', 'chart', 'table', 'widget'];

const meta = {
  title: 'Components/LoadingSkeleton',
  component: LoadingSkeleton,
  args: { shape: 'widget' },
  argTypes: { shape: { control: 'select', options: SHAPES } },
  render: (args) => (
    <WidgetCanvas width={420} height={240}>
      <LoadingSkeleton {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof LoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Generic widget shape: heading, chart and two rows. */
export const Default: Story = {};

/** A table with eight rows. */
export const Configured: Story = { args: { shape: 'table', rows: 8 } };

/** All four shapes side by side; switch themes to see the shimmer follow the tokens. */
export const AllShapes: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-3">
      {SHAPES.map((shape) => (
        <WidgetCanvas key={shape} width={300} height={180}>
          <LoadingSkeleton shape={shape} />
        </WidgetCanvas>
      ))}
    </div>
  ),
};
