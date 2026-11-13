import type { Meta, StoryObj } from '@storybook/react';
import { ReadOnlyWidget } from '@/grid/ReadOnlyWidget';
import { fixtureFetcher, WithFetcher } from './helpers';

const meta = {
  title: 'Grid/ReadOnlyWidget',
  component: ReadOnlyWidget,
  decorators: [
    (Story) => (
      <WithFetcher fetcher={fixtureFetcher}>
        <div className="h-[320px] w-[520px]">{Story()}</div>
      </WithFetcher>
    ),
  ],
  args: {
    instance: {
      instanceId: 'shared-var',
      widgetId: 'var-gauge',
      config: {},
      position: { x: 0, y: 0, w: 4, h: 5 },
      title: 'Value at Risk',
    },
  },
} satisfies Meta<typeof ReadOnlyWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A widget in a shared layout: live data, no layout controls. */
export const Default: Story = {};

/** A widget type this build does not have. */
export const Unknown: Story = {
  args: {
    instance: {
      instanceId: 'shared-esg',
      widgetId: 'esg-scorecard',
      config: {},
      position: { x: 0, y: 0, w: 4, h: 5 },
    },
  },
};
