import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SchemaForm } from '@/components/SchemaForm';
import type { WidgetConfig } from '@/types';
import { navPerformanceDefinition } from '@/widgets/nav-performance/config';
import { varGaugeDefinition } from '@/widgets/var-gauge/config';

function SchemaFormHarness({ which }: { which: 'var' | 'nav' }) {
  const def = which === 'var' ? varGaugeDefinition : navPerformanceDefinition;
  const [value, setValue] = useState<WidgetConfig>({ ...def.defaultConfig });
  return (
    <div className="flex w-96 flex-col gap-4">
      <SchemaForm
        schema={def.configSchema}
        value={value}
        onChange={(k, v) => setValue((s) => ({ ...s, [k]: v }))}
      />
      <pre className="num rounded border border-line bg-panel p-2 text-2xs text-muted">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

const meta = {
  title: 'Components/SchemaForm',
  component: SchemaFormHarness,
  args: { which: 'var' },
} satisfies Meta<typeof SchemaFormHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Value at Risk widget's JSON Schema rendered as a form. */
export const VarGaugeSchema: Story = {};
export const NavChartSchema: Story = { args: { which: 'nav' } };
