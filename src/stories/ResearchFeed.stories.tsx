import type { Meta, StoryObj } from '@storybook/react';
import { researchFeedDefinition } from '@/widgets/research-feed/config';
import ResearchFeed from '@/widgets/research-feed/index';
import { configuredConfig, fixtureData } from '@/widgets/research-feed/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/Research Feed',
  component: ResearchFeed,
  parameters: { docs: { description: { component: researchFeedDefinition.description } } },
  args: {
    instanceId: 'story-research-feed',
    config: researchFeedDefinition.defaultConfig,
    data: fixtureData(),
    width: 640,
    height: 380,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <ResearchFeed {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof ResearchFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
