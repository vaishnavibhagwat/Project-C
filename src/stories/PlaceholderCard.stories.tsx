import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { PlaceholderCard } from '@/grid/PlaceholderCard';
import { PLACEHOLDER_WIDGET_ID } from '@/registry/placeholder';
import { useWidgetStore } from '@/store/widgetStore';
import { WidgetCanvas } from './helpers';

const SLOT_ID = 'story-empty-slot';

/** Seeds an empty-slot instance so choosing a widget works in the story. */
function SlotDemo() {
  useEffect(() => {
    useWidgetStore.getState().upsertInstances([
      {
        instanceId: SLOT_ID,
        widgetId: PLACEHOLDER_WIDGET_ID,
        config: {},
        position: { x: 0, y: 0, w: 4, h: 3 },
      },
    ]);
  }, []);
  return (
    <WidgetCanvas width={320} height={200}>
      <PlaceholderCard page="research" instanceId={SLOT_ID} />
    </WidgetCanvas>
  );
}

const meta = {
  title: 'Grid/PlaceholderCard',
  component: SlotDemo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SlotDemo>;

export default meta;

/** An empty slot: "Choose widget" lists every registered widget by category. */
export const Default: StoryObj<typeof meta> = {};
