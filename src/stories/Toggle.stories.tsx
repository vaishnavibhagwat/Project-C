import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Toggle } from '@/components/Toggle';

function ToggleDemo({ size }: { size: 'sm' | 'md' }) {
  const [on, setOn] = useState(true);
  return (
    <div className="flex items-center gap-4 p-4 text-sm">
      <label className="flex items-center gap-2">
        <Toggle size={size} checked={on} onCheckedChange={setOn} />
        Live ticks outside NSE hours
      </label>
      <Toggle
        size={size}
        label="Disabled"
        checked={false}
        onCheckedChange={() => undefined}
        disabled
      />
    </div>
  );
}

const meta = {
  title: 'Components/Toggle',
  component: ToggleDemo,
  args: { size: 'md' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md'] } },
} satisfies Meta<typeof ToggleDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: 'sm' } };
