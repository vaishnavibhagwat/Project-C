import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Tabs } from '@/components/Tabs';

type Section = 'grid' | 'appearance' | 'data' | 'locked';

function TabsDemo() {
  const [tab, setTab] = useState<Section>('grid');
  return (
    <div className="w-[480px] p-4">
      <Tabs<Section>
        label="Settings sections"
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: 'grid',
            label: 'Grid',
            content: <p className="text-sm">12 columns · 60 px rows</p>,
          },
          {
            value: 'appearance',
            label: 'Appearance',
            content: <p className="text-sm">Midnight Graphite</p>,
          },
          {
            value: 'data',
            label: 'Data feed',
            content: <p className="text-sm">Simulated, 5 s ticks</p>,
          },
          { value: 'locked', label: 'Admin', content: null, disabled: true },
        ]}
      />
    </div>
  );
}

const meta = {
  title: 'Components/Tabs',
  component: TabsDemo,
} satisfies Meta<typeof TabsDemo>;

export default meta;

/** Arrow keys, Home and End switch tabs; disabled tabs are skipped. */
export const Default: StoryObj<typeof meta> = {};
