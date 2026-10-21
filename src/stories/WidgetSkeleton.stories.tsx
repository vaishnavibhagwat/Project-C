import type { Meta, StoryObj } from '@storybook/react';
import { WidgetSkeleton } from '@/components/WidgetSkeleton';
import type { SkeletonVariant } from '@/registry/defineWidget';
import { WidgetCanvas } from './helpers';

const VARIANTS: SkeletonVariant[] = [
  'line-chart',
  'area-chart',
  'donut',
  'bars',
  'table',
  'feed',
  'gauge',
  'tiles',
  'heatmap',
  'treemap',
];

const meta = {
  title: 'Components/WidgetSkeleton',
  component: WidgetSkeleton,
  args: { variant: 'line-chart' },
  argTypes: { variant: { control: 'select', options: VARIANTS } },
  render: (args) => (
    <WidgetCanvas width={420} height={240}>
      <WidgetSkeleton {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof WidgetSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AllShapes: Story = {
  render: () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
      {VARIANTS.map((v) => (
        <div key={v}>
          <p className="mb-1 text-2xs text-muted">{v}</p>
          <WidgetCanvas width={260} height={160}>
            <WidgetSkeleton variant={v} />
          </WidgetCanvas>
        </div>
      ))}
    </div>
  ),
};
