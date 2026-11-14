import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { WorkspacePicker } from '@/layout/WorkspacePicker';

const meta = {
  title: 'Layout/WorkspacePicker',
  component: WorkspacePicker,
  args: { open: true, onClose: fn(), onChosen: fn() },
} satisfies Meta<typeof WorkspacePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** First-run picker: five workspace cards with layout thumbnails, and Skip. */
export const Default: Story = {};

/** Closed (the picker renders nothing). */
export const Closed: Story = { args: { open: false } };
