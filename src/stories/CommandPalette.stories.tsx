import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { CommandPalette } from '@/layout/CommandPalette';
import { ShortcutsList } from '@/layout/ShortcutsList';

const meta = {
  title: 'Layout/CommandPalette',
  component: CommandPalette,
  args: { open: true, onClose: fn(), onSelect: fn() },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Global search (Ctrl/⌘+K) over pages, widgets, Nifty 50 symbols and commands. */
export const Open: Story = {};

export const KeyboardShortcuts: Story = {
  render: () => <ShortcutsList />,
};
