import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SearchInput } from '@/components/SearchInput';

/** Shows the debounced search beside the box so the 300 ms delay is visible. */
function SearchDemo({ initial = '', debounceMs }: { initial?: string; debounceMs?: number }) {
  const [query, setQuery] = useState(initial);
  return (
    <div className="flex w-72 flex-col gap-2">
      <SearchInput
        label="Search widgets"
        placeholder="Search widgets"
        value={query}
        onSearch={setQuery}
        debounceMs={debounceMs}
      />
      <p className="text-xs text-muted">
        Searching for: <span className="text-fg">{query === '' ? '(nothing)' : query}</span>
      </p>
    </div>
  );
}

const meta = {
  title: 'Components/SearchInput',
  component: SearchDemo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SearchDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty. Typing searches 300 ms after the last key; Enter searches at once. */
export const Default: Story = {};

/** Prefilled, with the clear button showing. Escape or the button clears it. */
export const Configured: Story = { args: { initial: 'risk', debounceMs: 500 } };
