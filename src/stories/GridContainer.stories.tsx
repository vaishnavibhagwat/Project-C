import type { Meta, StoryObj } from '@storybook/react';
import { GridContainer } from '@/grid/GridContainer';
import { GridItem } from '@/grid/GridItem';
import { WidgetFrame } from '@/grid/WidgetFrame';
import { fixtureFetcher, WithFetcher } from './helpers';

const meta = {
  title: 'Grid/GridContainer',
  component: GridContainer,
  parameters: { layout: 'fullscreen' },
  args: { page: 'workstation' },
  decorators: [
    (Story) => (
      <WithFetcher fetcher={fixtureFetcher}>
        <div className="p-3">{Story()}</div>
      </WithFetcher>
    ),
  ],
} satisfies Meta<typeof GridContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default workstation grid. Drag by the header, resize from the corner; widgets push each
 * other and never overlap. Resize the browser across 1280 px and 768 px to see the desktop,
 * tablet (6 columns) and mobile (1 column, stacked) layouts, each stored separately.
 */
export const Workstation: Story = {};
export const RiskAnalytics: Story = { args: { page: 'risk' } };

/** One GridItem cell on its own: the wrapper react-grid-layout positions, holding a widget frame. */
export const SingleGridItem: Story = {
  render: () => (
    <GridItem instanceId="workstation-var-gauge" style={{ width: 360, height: 340 }}>
      <WidgetFrame page="workstation" instanceId="workstation-var-gauge" />
    </GridItem>
  ),
};
