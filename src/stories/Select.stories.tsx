import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Select } from '@/components/Select';

const SOURCES = [
  { value: 'all', label: 'All sources' },
  { value: 'Reuters', label: 'Reuters' },
  { value: 'Bloomberg', label: 'Bloomberg' },
] as const;
type Source = (typeof SOURCES)[number]['value'];

function SelectDemo({ initial, hideLabel }: { initial: Source; hideLabel?: boolean }) {
  const [value, setValue] = useState<Source>(initial);
  return (
    <Select<Source>
      label="Source"
      value={value}
      options={SOURCES}
      onValueChange={setValue}
      hideLabel={hideLabel}
    />
  );
}

const meta = {
  title: 'Components/Select',
  component: SelectDemo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SelectDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Toolbar picker: arrows, Home / End and type-ahead move through the options. */
export const Default: Story = { args: { initial: 'all' } };

/** Value only (the label stays as the accessible name). */
export const Configured: Story = { args: { initial: 'Bloomberg', hideLabel: true } };
