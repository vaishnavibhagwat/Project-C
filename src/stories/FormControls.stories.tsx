import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Segmented, SelectField, Switch, TextField } from '@/components/FormControls';

type Range = '1M' | '1Y' | '5Y';

function FormControlsDemo() {
  const [name, setName] = useState('Desk layout');
  const [limit, setLimit] = useState('9');
  const [range, setRange] = useState<Range>('1Y');
  const [method, setMethod] = useState('historical');
  const [show, setShow] = useState(true);
  return (
    <div className="flex w-80 flex-col gap-4">
      <TextField label="Layout name" value={name} onValueChange={setName} />
      <TextField
        label="VaR limit (% of AUM)"
        type="number"
        value={limit}
        onValueChange={setLimit}
        error={Number(limit) > 5 ? 'Maximum is 5.' : null}
        description="Between 0.5 and 5."
      />
      <SelectField
        label="Method"
        value={method}
        onValueChange={setMethod}
        options={[
          { value: 'historical', label: 'Historical simulation' },
          { value: 'parametric', label: 'Parametric (normal)' },
        ]}
      />
      <Switch label="Show benchmark" checked={show} onCheckedChange={setShow} />
      <Segmented<Range>
        label="Range"
        hideLabel={false}
        value={range}
        onValueChange={setRange}
        options={[
          { value: '1M', label: '1M' },
          { value: '1Y', label: '1Y' },
          { value: '5Y', label: '5Y' },
        ]}
      />
    </div>
  );
}

const meta = {
  title: 'Components/FormControls',
  component: FormControlsDemo,
} satisfies Meta<typeof FormControlsDemo>;

export default meta;

/** TextField (with validation error), SelectField, Switch and Segmented. */
export const AllControls: StoryObj<typeof meta> = {};
