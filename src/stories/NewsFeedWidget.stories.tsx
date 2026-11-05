import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { newsFeedDefinition } from '@/widgets/news-feed/config';
import NewsFeed from '@/widgets/news-feed/index';
import { configuredConfig, fixtureData } from '@/widgets/news-feed/__tests__';
import { WidgetCanvas } from './helpers';

const meta = {
  title: 'Widgets/News Feed',
  component: NewsFeed,
  parameters: { docs: { description: { component: newsFeedDefinition.description } } },
  args: {
    instanceId: 'story-news-feed',
    config: newsFeedDefinition.defaultConfig,
    data: fixtureData(),
    isLoading: false,
    error: null,
    isStale: false,
    lastUpdated: '2026-10-20T11:42:00+05:30',
    onConfigChange: fn(),
    width: 360,
    height: 420,
  },
  render: (args) => (
    <WidgetCanvas width={args.width} height={args.height}>
      <NewsFeed {...args} />
    </WidgetCanvas>
  ),
} satisfies Meta<typeof NewsFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default configuration with the shared seeded dataset. */
export const Default: Story = {};

/** A non-default configuration (see the widget's settings panel for every option). */
export const Configured: Story = { args: { config: configuredConfig } };
